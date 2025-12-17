const { Delivery, Driver, Vehicle } = require("../models");
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;
const axios = require("axios");

class AdminManipulationController {
  constructor() {
    this.activeSimulations = new Map();
    this.simulationIntervals = new Map();
    this.mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
  }

  // ============================================
  // GET DELIVERY DETAILS WITH MAPBOX DATA
  // ============================================

  getDelivery = async (req, res) => {
    try {
      const { id } = req.params;
      const delivery = await Delivery.findById(id)
        .populate("driver", "name phone currentLocation status")
        .populate("vehicle", "plateNumber model currentLocation status")
        .populate("createdBy updatedBy", "name email");

      if (!delivery) {
        return res.status(404).json({
          success: false,
          message: "Delivery not found",
        });
      }

      // Get active simulation status
      const simulation = this.activeSimulations.get(delivery._id.toString());

      // Prepare Mapbox-ready data
      const mapboxData = delivery.getMapboxData
        ? delivery.getMapboxData()
        : {
            points: {
              pickup: {
                coordinates: delivery.sender.address.coordinates.coordinates,
                address: delivery.pickupAddress,
              },
              delivery: {
                coordinates: delivery.receiver.address.coordinates.coordinates,
                address: delivery.deliveryAddress,
              },
              current: {
                coordinates: delivery.trackingData.currentLocation.coordinates,
                progress: delivery.trackingData.routeProgress,
              },
            },
            status: delivery.status,
          };

      res.json({
        success: true,
        data: {
          ...delivery.toObject(),
          simulation,
          mapboxData,
        },
      });
    } catch (error) {
      console.error("Error getting delivery:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch delivery",
        error: error.message,
      });
    }
  };

  // ============================================
  // GEOCODE ADDRESSES (MAPBOX INTEGRATION)
  // ============================================

  geocodeAddress = async (req, res) => {
    try {
      const { id } = req.params;
      const { address, addressType = "sender" } = req.body;

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          message: "Delivery not found",
        });
      }

      if (!this.mapboxToken) {
        return res.status(400).json({
          success: false,
          message: "Mapbox access token not configured",
        });
      }

      // Use Delivery model's geocodeAddress method if available
      if (delivery.geocodeAddress) {
        const result = await delivery.geocodeAddress(address, addressType);
        return res.json({
          success: result.success,
          message: result.success
            ? `Address geocoded successfully`
            : `Geocoding failed: ${result.error}`,
          data: result,
        });
      }

      // Fallback geocoding implementation
      const encodedAddress = encodeURIComponent(address);
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${this.mapboxToken}&limit=1`;

      const response = await axios.get(url);
      const features = response.data.features;

      if (features && features.length > 0) {
        const [longitude, latitude] = features[0].center;
        const placeName = features[0].place_name;

        // Update the specified address
        if (addressType === "sender") {
          delivery.sender.address.coordinates.coordinates = [
            longitude,
            latitude,
          ];
          delivery.sender.address.geocoded = true;
          delivery.sender.address.lastGeocodedAt = new Date();
        } else if (addressType === "receiver") {
          delivery.receiver.address.coordinates.coordinates = [
            longitude,
            latitude,
          ];
          delivery.receiver.address.geocoded = true;
          delivery.receiver.address.lastGeocodedAt = new Date();
        }

        await delivery.save();

        res.json({
          success: true,
          message: "Address geocoded successfully",
          data: {
            coordinates: [longitude, latitude],
            placeName,
            addressType,
          },
        });
      } else {
        throw new Error("Address not found");
      }
    } catch (error) {
      console.error("Error geocoding address:", error);
      res.status(500).json({
        success: false,
        message: "Failed to geocode address",
        error: error.message,
      });
    }
  };

  // ============================================
  // GET MAPBOX DIRECTIONS
  // ============================================

  getDirections = async (req, res) => {
    try {
      const { id } = req.params;
      const { profile = "driving" } = req.body; // driving, walking, cycling

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          message: "Delivery not found",
        });
      }

      if (!this.mapboxToken) {
        return res.status(400).json({
          success: false,
          message: "Mapbox access token not configured",
        });
      }

      // Check if addresses are geocoded
      if (
        !delivery.sender.address.geocoded ||
        !delivery.receiver.address.geocoded
      ) {
        return res.status(400).json({
          success: false,
          message: "Please geocode both addresses first",
        });
      }

      // Use Delivery model's getMapboxDirections method if available
      if (delivery.getMapboxDirections) {
        const result = await delivery.getMapboxDirections(profile);
        return res.json({
          success: result.success,
          message: result.success
            ? `Route calculated successfully`
            : `Failed to calculate route: ${result.error}`,
          data: result,
        });
      }

      // Fallback directions implementation
      const startCoords = delivery.sender.address.coordinates.coordinates;
      const endCoords = delivery.receiver.address.coordinates.coordinates;

      const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${startCoords[0]},${startCoords[1]};${endCoords[0]},${endCoords[1]}?access_token=${this.mapboxToken}&geometries=geojson&steps=true&overview=full`;

      const response = await axios.get(url);
      const route = response.data.routes[0];

      // Store route data
      delivery.route = {
        mapboxDirections: response.data,
        totalDistance: route.distance,
        totalDuration: route.duration,
        geometry: route.geometry,
        bounds: this.calculateBounds(route.geometry),
        legs: route.legs,
        optimized: false,
      };

      await delivery.save();

      res.json({
        success: true,
        message: "Route calculated successfully",
        data: {
          distance: route.distance,
          duration: route.duration,
          geometry: route.geometry,
        },
      });
    } catch (error) {
      console.error("Error getting directions:", error);
      res.status(500).json({
        success: false,
        message: "Failed to calculate route",
        error: error.message,
      });
    }
  };

  // ============================================
  // ENHANCED SIMULATION WITH MAPBOX ROUTE
  // ============================================

  startSimulation = async (req, res) => {
    try {
      const { id } = req.params;
      const {
        timeInterval = 30, // Time in minutes for complete trip
        useRoute = true, // Use Mapbox route if available
      } = req.body;

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          message: "Delivery not found",
        });
      }

      // Check if simulation already running
      if (this.activeSimulations.has(delivery._id.toString())) {
        return res.status(400).json({
          success: false,
          message: "Simulation already running for this delivery",
        });
      }

      // Ensure addresses are geocoded
      if (
        !delivery.sender.address.geocoded ||
        !delivery.receiver.address.geocoded
      ) {
        return res.status(400).json({
          success: false,
          message: "Please geocode both addresses before starting simulation",
        });
      }

      // Get Mapbox directions if needed
      if (useRoute && (!delivery.route || !delivery.route.geometry)) {
        if (delivery.getMapboxDirections) {
          const routeResult = await delivery.getMapboxDirections("driving");
          if (!routeResult.success) {
            console.warn(
              "Failed to get Mapbox directions, falling back to linear simulation"
            );
          }
        }
      }

      // Update delivery status
      delivery.status = "in_transit";
      delivery.trackingData.active = true;
      delivery.trackingData.lastUpdated = new Date();

      await delivery.save();

      // Store simulation state
      const simulationState = {
        deliveryId: delivery._id,
        active: true,
        startTime: new Date(),
        totalTime: timeInterval * 60 * 1000, // Convert minutes to milliseconds
        useRoute: useRoute && delivery.route && delivery.route.geometry,
        routeGeometry: delivery.route?.geometry,
        timeInterval,
      };

      this.activeSimulations.set(delivery._id.toString(), simulationState);

      // Start simulation loop
      this.startMovementSimulation(delivery, simulationState);

      // Broadcast simulation start
      this.broadcastUpdate(delivery, "simulation_started", {
        deliveryId: delivery._id,
        trackingId: delivery.trackingId,
        useRoute: simulationState.useRoute,
        timeInterval,
      });

      res.json({
        success: true,
        message: `Bus movement simulation started. Estimated arrival: ${timeInterval} minutes`,
        data: {
          deliveryId: delivery._id,
          trackingId: delivery.trackingId,
          timeInterval,
          useRoute: simulationState.useRoute,
        },
      });
    } catch (error) {
      console.error("Error starting simulation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to start simulation",
        error: error.message,
      });
    }
  };

  // ============================================
  // ENHANCED MOVEMENT SIMULATION WITH ROUTE SUPPORT
  // ============================================

  startMovementSimulation = (delivery, simulationState) => {
    const deliveryId = delivery._id.toString();

    // Clear any existing interval
    if (this.simulationIntervals.has(deliveryId)) {
      clearInterval(this.simulationIntervals.get(deliveryId));
    }

    let simulationInterval;

    if (simulationState.useRoute && simulationState.routeGeometry) {
      // Route-based simulation along Mapbox route
      simulationInterval = this.startRouteSimulation(delivery, simulationState);
    } else {
      // Linear simulation (original fallback)
      simulationInterval = this.startLinearSimulation(
        delivery,
        simulationState
      );
    }

    this.simulationIntervals.set(deliveryId, simulationInterval);
  };

  startLinearSimulation = (delivery, simulationState) => {
    const deliveryId = delivery._id.toString();

    // Get start and end coordinates
    const startCoords = delivery.sender.address.coordinates.coordinates;
    const endCoords = delivery.receiver.address.coordinates.coordinates;

    const startLng = startCoords[0];
    const startLat = startCoords[1];
    const endLng = endCoords[0];
    const endLat = endCoords[1];

    // Calculate movement increments per second
    const totalSeconds = simulationState.timeInterval * 60;
    const lngIncrement = (endLng - startLng) / totalSeconds;
    const latIncrement = (endLat - startLat) / totalSeconds;

    let currentLng = startLng;
    let currentLat = startLat;
    let secondsElapsed = 0;

    return setInterval(async () => {
      try {
        const simulation = this.activeSimulations.get(deliveryId);
        if (!simulation || !simulation.active) {
          clearInterval(this.simulationIntervals.get(deliveryId));
          this.simulationIntervals.delete(deliveryId);
          return;
        }

        // Calculate new position
        currentLng += lngIncrement;
        currentLat += latIncrement;
        secondsElapsed++;

        // Calculate progress percentage
        const progress = Math.min(100, (secondsElapsed / totalSeconds) * 100);

        // Update delivery position
        await this.updatePosition(delivery, currentLng, currentLat, progress);

        // Check if reached destination
        if (progress >= 100) {
          this.completeSimulation(delivery);
        }
      } catch (error) {
        console.error("Error in linear simulation:", error);
        this.stopSimulationInternal(deliveryId);
      }
    }, 1000);
  };

  startRouteSimulation = (delivery, simulationState) => {
    const deliveryId = delivery._id.toString();
    const routeGeometry = simulationState.routeGeometry;

    if (
      !routeGeometry ||
      !routeGeometry.coordinates ||
      routeGeometry.coordinates.length < 2
    ) {
      console.warn("Invalid route geometry, falling back to linear simulation");
      return this.startLinearSimulation(delivery, simulationState);
    }

    // Extract coordinates from route geometry
    const routeCoords = routeGeometry.coordinates;
    const totalDistance =
      delivery.route?.totalDistance || this.calculateRouteDistance(routeCoords);
    const totalTimeSeconds = simulationState.timeInterval * 60;
    const speed = totalDistance / totalTimeSeconds; // meters per second

    let currentDistance = 0;
    let secondsElapsed = 0;

    return setInterval(async () => {
      try {
        const simulation = this.activeSimulations.get(deliveryId);
        if (!simulation || !simulation.active) {
          clearInterval(this.simulationIntervals.get(deliveryId));
          this.simulationIntervals.delete(deliveryId);
          return;
        }

        // Update distance traveled
        currentDistance += speed;
        secondsElapsed++;

        // Calculate progress
        const progress = Math.min(100, (currentDistance / totalDistance) * 100);

        // Find position along route
        const position = this.getPositionAlongRoute(
          routeCoords,
          currentDistance
        );
        if (position) {
          await this.updatePosition(
            delivery,
            position[0],
            position[1],
            progress
          );
        }

        // Check if reached destination
        if (progress >= 100) {
          this.completeSimulation(delivery);
        }
      } catch (error) {
        console.error("Error in route simulation:", error);
        this.stopSimulationInternal(deliveryId);
      }
    }, 1000);
  };

  // ============================================
  // ENHANCED POSITION UPDATE WITH MAPBOX DATA
  // ============================================

  updatePosition = async (
    delivery,
    longitude,
    latitude,
    progress,
    speed = 0,
    bearing = 0
  ) => {
    // Update delivery tracking data
    delivery.trackingData.currentLocation.coordinates = [longitude, latitude];
    delivery.trackingData.routeProgress = progress;
    delivery.trackingData.lastUpdated = new Date();
    delivery.trackingData.speed = speed;
    delivery.trackingData.bearing = bearing;

    // Update driver location if exists
    if (delivery.driver) {
      await Driver.findByIdAndUpdate(delivery.driver._id, {
        currentLocation: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        lastLocationUpdate: new Date(),
      });
    }

    // Update vehicle location if exists
    if (delivery.vehicle) {
      await Vehicle.findByIdAndUpdate(delivery.vehicle._id, {
        currentLocation: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        lastLocationUpdate: new Date(),
      });
    }

    await delivery.save();

    // Prepare Mapbox data for broadcast
    const mapboxData = delivery.getMapboxData
      ? delivery.getMapboxData()
      : {
          points: {
            current: {
              coordinates: [longitude, latitude],
              progress: progress,
              bearing: bearing,
              speed: speed,
            },
          },
          status: delivery.status,
        };

    // Broadcast update via WebSocket
    this.broadcastUpdate(delivery, "position_updated", {
      deliveryId: delivery._id,
      trackingId: delivery.trackingId,
      position: [longitude, latitude],
      progress,
      speed,
      bearing,
      timestamp: new Date(),
      mapboxData,
    });
  };

  // ============================================
  // ENHANCED INCIDENT REPORTING WITH GEOCODING
  // ============================================

  reportIncident = async (req, res) => {
    try {
      const { id } = req.params;
      const {
        type,
        description,
        estimatedDelay,
        emergencyServices,
        address, // Optional: address string for geocoding
        coordinates, // Optional: [lng, lat]
        severity = "medium",
      } = req.body;

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          message: "Delivery not found",
        });
      }

      // Use Delivery model's addIncident method if available
      if (delivery.addIncident) {
        const incidentData = {
          type: type || "accident",
          description: description || "Incident reported",
          estimatedDelay: estimatedDelay || 30,
          emergencyServices: emergencyServices || false,
          address: address,
          severity: severity,
        };

        if (coordinates) {
          incidentData.location = {
            type: "Point",
            coordinates: coordinates,
          };
        }

        await delivery.addIncident(incidentData);

        // Get updated incident
        const newIncident = delivery.incidents[delivery.incidents.length - 1];

        // Broadcast incident
        this.broadcastUpdate(delivery, "incident_reported", {
          deliveryId: delivery._id,
          trackingId: delivery.trackingId,
          incident: newIncident,
          mapboxData: delivery.getMapboxData ? delivery.getMapboxData() : null,
        });

        // Notify emergency services if needed
        if (emergencyServices) {
          this.notifyEmergencyServices(delivery, newIncident);
        }

        return res.json({
          success: true,
          message: "Incident reported successfully",
          data: { incident: newIncident },
        });
      }

      // Fallback incident creation
      const incident = {
        _id: new ObjectId(),
        type: type || "accident",
        description: description || "Incident reported",
        reportedAt: new Date(),
        estimatedDelay: estimatedDelay || 30,
        emergencyServices: emergencyServices || false,
        severity: severity,
      };

      // Add location if provided
      if (coordinates) {
        incident.location = {
          type: "Point",
          coordinates: coordinates,
        };
      } else if (address) {
        // Try to geocode the address
        try {
          const geocodeResult = await this.geocodeAddressInternal(address);
          if (geocodeResult.success) {
            incident.location = {
              type: "Point",
              coordinates: geocodeResult.coordinates,
            };
            incident.address = address;
          }
        } catch (error) {
          console.warn("Failed to geocode incident address:", error);
        }
      }

      // Add to incidents array
      if (!delivery.incidents) {
        delivery.incidents = [];
      }
      delivery.incidents.push(incident);

      // Update delivery status
      delivery.status = "delayed";
      delivery.delayInfo = {
        reason: `Incident: ${type}`,
        description,
        estimatedDelay: incident.estimatedDelay,
        reportedAt: new Date(),
        location: incident.location,
      };

      await delivery.save();

      // Broadcast incident
      this.broadcastUpdate(delivery, "incident_reported", {
        deliveryId: delivery._id,
        trackingId: delivery.trackingId,
        incident,
      });

      // Notify emergency services if needed
      if (emergencyServices) {
        this.notifyEmergencyServices(delivery, incident);
      }

      res.json({
        success: true,
        message: "Incident reported successfully",
        data: { incident },
      });
    } catch (error) {
      console.error("Error reporting incident:", error);
      res.status(500).json({
        success: false,
        message: "Failed to report incident",
        error: error.message,
      });
    }
  };

  // ============================================
  // MANUAL POSITION UPDATE WITH MAPBOX
  // ============================================

  updatePositionManual = async (req, res) => {
    try {
      const { id } = req.params;
      const { latitude, longitude, progress } = req.body;

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          message: "Delivery not found",
        });
      }

      // Update position
      const newProgress =
        progress !== undefined ? progress : delivery.trackingData.routeProgress;
      await this.updatePosition(delivery, longitude, latitude, newProgress);

      res.json({
        success: true,
        message: "Position updated",
        data: {
          position: [longitude, latitude],
          progress: newProgress,
          deliveryId: delivery._id,
          mapboxData: delivery.getMapboxData ? delivery.getMapboxData() : null,
        },
      });
    } catch (error) {
      console.error("Error updating position:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update position",
        error: error.message,
      });
    }
  };

  // ============================================
  // BATCH GEOCODING
  // ============================================

  batchGeocode = async (req, res) => {
    try {
      const { limit = 10 } = req.body;

      // Use Delivery model's batchGeocode method if available
      if (Delivery.batchGeocode) {
        const results = await Delivery.batchGeocode(limit);
        return res.json({
          success: true,
          message: `Batch geocoding completed for ${results.length} deliveries`,
          data: results,
        });
      }

      res.status(400).json({
        success: false,
        message: "Batch geocoding not available in this model",
      });
    } catch (error) {
      console.error("Error in batch geocoding:", error);
      res.status(500).json({
        success: false,
        message: "Failed to batch geocode",
        error: error.message,
      });
    }
  };

  // ============================================
  // HELPER METHODS
  // ============================================

  completeSimulation = async (delivery) => {
    const deliveryId = delivery._id.toString();

    // Clear simulation interval
    if (this.simulationIntervals.has(deliveryId)) {
      clearInterval(this.simulationIntervals.get(deliveryId));
      this.simulationIntervals.delete(deliveryId);
    }

    // Remove from active simulations
    this.activeSimulations.delete(deliveryId);

    // Mark as delivered
    if (delivery.markAsDelivered) {
      await delivery.markAsDelivered();
    } else {
      delivery.status = "delivered";
      delivery.actualDelivery = new Date();
      delivery.trackingData.active = false;
      delivery.trackingData.isMoving = false;
      await delivery.save();
    }

    // Broadcast completion
    this.broadcastUpdate(delivery, "delivery_completed", {
      deliveryId: delivery._id,
      trackingId: delivery.trackingId,
      completedAt: new Date(),
    });
  };

  stopSimulationInternal = (deliveryId) => {
    if (this.simulationIntervals.has(deliveryId)) {
      clearInterval(this.simulationIntervals.get(deliveryId));
      this.simulationIntervals.delete(deliveryId);
    }
    this.activeSimulations.delete(deliveryId);
  };

  stopSimulation = async (req, res) => {
    try {
      const { id } = req.params;
      const { reason = "Manual stop" } = req.body;

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          message: "Delivery not found",
        });
      }

      const deliveryId = delivery._id.toString();
      this.stopSimulationInternal(deliveryId);

      // Update delivery status
      delivery.trackingData.active = false;
      delivery.trackingData.isMoving = false;
      await delivery.save();

      // Broadcast simulation stop
      this.broadcastUpdate(delivery, "simulation_stopped", {
        deliveryId: delivery._id,
        trackingId: delivery.trackingId,
        reason,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: "Simulation stopped",
        data: {
          deliveryId: delivery._id,
          trackingId: delivery.trackingId,
        },
      });
    } catch (error) {
      console.error("Error stopping simulation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to stop simulation",
        error: error.message,
      });
    }
  };

  broadcastUpdate = (delivery, event, data) => {
    if (global.io) {
      global.io
        .to(`delivery_${delivery.trackingId}`)
        .to(`admin_delivery_${delivery._id}`)
        .emit(event, data);
    }
  };

  notifyEmergencyServices = (delivery, incident) => {
    // In production, integrate with emergency services API
    console.log(
      `🚨 EMERGENCY SERVICES NOTIFIED for delivery ${delivery.trackingId}`
    );
    console.log(`Incident: ${incident.type}`);
    console.log(`Severity: ${incident.severity}`);
    console.log(`Description: ${incident.description}`);

    if (global.io) {
      global.io.emit("emergency_notification", {
        deliveryId: delivery._id,
        trackingId: delivery.trackingId,
        incident,
        timestamp: new Date(),
      });
    }
  };

  // ============================================
  // MAPBOX ROUTE HELPER METHODS
  // ============================================

  calculateBounds = (geometry) => {
    if (!geometry || !geometry.coordinates) {
      return null;
    }

    const coords = geometry.coordinates;
    let minLng = 180,
      maxLng = -180,
      minLat = 90,
      maxLat = -90;

    coords.forEach((coord) => {
      const [lng, lat] = coord;
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    });

    return [
      [minLng, minLat],
      [maxLng, maxLat],
    ];
  };

  calculateRouteDistance = (coordinates) => {
    let totalDistance = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const [lng1, lat1] = coordinates[i];
      const [lng2, lat2] = coordinates[i + 1];
      totalDistance += this.calculateDistance(lat1, lng1, lat2, lng2);
    }
    return totalDistance;
  };

  calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  getPositionAlongRoute = (coordinates, distance) => {
    let accumulatedDistance = 0;

    for (let i = 0; i < coordinates.length - 1; i++) {
      const [lng1, lat1] = coordinates[i];
      const [lng2, lat2] = coordinates[i + 1];
      const segmentDistance = this.calculateDistance(lat1, lng1, lat2, lng2);

      if (accumulatedDistance + segmentDistance >= distance) {
        // Position is within this segment
        const fraction = (distance - accumulatedDistance) / segmentDistance;
        const lng = lng1 + (lng2 - lng1) * fraction;
        const lat = lat1 + (lat2 - lat1) * fraction;
        return [lng, lat];
      }

      accumulatedDistance += segmentDistance;
    }

    // Return last coordinate if distance exceeds route length
    return coordinates[coordinates.length - 1];
  };

  geocodeAddressInternal = async (address) => {
    if (!this.mapboxToken) {
      throw new Error("Mapbox access token not configured");
    }

    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${this.mapboxToken}&limit=1`;

    const response = await axios.get(url);
    const features = response.data.features;

    if (features && features.length > 0) {
      return {
        success: true,
        coordinates: features[0].center,
        placeName: features[0].place_name,
      };
    } else {
      throw new Error("Address not found");
    }
  };
}

module.exports = new AdminManipulationController();
