const { Delivery, Vehicle, Driver } = require("../models");
const mongoose = require("mongoose");
const axios = require("axios"); // Added missing import
const DeliveryService = require("../services/deliveryService");
const {
  formatDate,
  getStatusColor,
  getSeverityColor,
} = require("../utils/helpers");

class AdminController {
  // Dashboard
  getDashboard = async (req, res) => {
    try {
      const data = await this.getDashboardInternalData();
      res.render("admin/dashboard", {
        title: "Admin Dashboard",
        stats: data.stats,
        recentActivities: data.recentActivities,
        admin: req.user,
      });
    } catch (error) {
      console.error("Dashboard Render Error:", error);
      res.render("admin", {
        title: "Admin Dashboard",
        error_msg: "Failed to load dashboard",
        stats: {},
        recentActivities: [],
        admin: req.user || null,
      });
    }
  };

  async getDashboardInternalData() {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const yesterdayStart = todayStart - 86400000;

    const [
      activeDeliveries,
      todayDeliveries,
      previousDeliveries,
      pendingDeliveries,
      delayedDeliveries,
      recentActivities,
    ] = await Promise.all([
      Delivery.countDocuments({ status: "in_transit" }),
      Delivery.countDocuments({ createdAt: { $gte: todayStart } }),
      Delivery.countDocuments({
        createdAt: { $gte: yesterdayStart, $lt: todayStart },
      }),
      Delivery.countDocuments({ status: "pending" }),
      Delivery.countDocuments({ status: "delayed" }),
      Delivery.find()
        .populate("driver", "name")
        .populate("vehicle", "plateNumber model")
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const deliveriesChange =
      previousDeliveries > 0
        ? Math.round(
            ((todayDeliveries - previousDeliveries) / previousDeliveries) * 100
          )
        : 0;

    return {
      stats: {
        activeDeliveries,
        todayDeliveries,
        deliveriesChange,
        pendingDeliveries,
        delayedDeliveries,
      },
      recentActivities,
    };
  }

  // Admin delivery list
  listDeliveries = async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        search,
        driver,
        date,
        category,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      // Build query
      const query = {};

      if (status && status !== "all") {
        query.status = status;
      }

      if (driver && driver !== "all") {
        if (mongoose.Types.ObjectId.isValid(driver)) {
          query.driver = driver;
        }
      }

      if (date) {
        const dateObj = new Date(date);
        const nextDay = new Date(dateObj);
        nextDay.setDate(nextDay.getDate() + 1);
        query.createdAt = { $gte: dateObj, $lt: nextDay };
      }

      if (category && category !== "all") {
        query["package.category"] = category;
      }

      // Search functionality
      if (search) {
        const searchRegex = new RegExp(search, "i");
        query.$or = [
          { trackingId: searchRegex },
          { "sender.name": searchRegex },
          { "sender.email": searchRegex },
          { "sender.phone": searchRegex },
          { "receiver.name": searchRegex },
          { "receiver.email": searchRegex },
          { "receiver.phone": searchRegex },
          { "package.description": searchRegex },
        ];
      }

      // Sorting
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

      // Execute query with pagination
      const deliveries = await Delivery.find(query)
        .populate("driver", "name phone email")
        .populate("vehicle", "plateNumber model")
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .lean();

      // Get total count for pagination
      const total = await Delivery.countDocuments(query);

      // Get status counts
      const statusCounts = await Delivery.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      const statusStats = {};
      statusCounts.forEach((stat) => {
        statusStats[stat._id] = stat.count;
      });

      // Get available drivers for filter dropdown
      const drivers = await Driver.find({ active: true }).select("name _id");

      res.render("admin/deliveries", {
        title: "Manage Deliveries",
        data: deliveries,
        total,
        query: {
          page: parseInt(page),
          limit: parseInt(limit),
          status,
          search,
          driver,
          date,
          category,
          sortBy,
          sortOrder,
        },
        formatDate: (date) => {
          return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        },
        getStatusColor: (status) => {
          const colors = {
            pending: "bg-yellow-100 text-yellow-800",
            in_transit: "bg-green-100 text-green-800",
            delayed: "bg-red-100 text-red-800",
            delivered: "bg-gray-100 text-gray-800",
            cancelled: "bg-gray-200 text-gray-800",
          };
          return colors[status] || "bg-gray-100 text-gray-800";
        },
        currentFilters: { status, search, driver, date, category },
      });
    } catch (error) {
      console.error("Error fetching deliveries:", error);
      req.flash("error", "Error fetching deliveries: " + error.message);
      res.redirect("/admin");
    }
  };

  // Show create form
  showCreateForm = async (req, res) => {
    try {
      const [drivers, vehicles] = await Promise.all([
        Driver.find({ status: "active" }).select("_id name phone"),
        Vehicle.find({ status: "available" }).select("_id plateNumber model"),
      ]);

      res.render("admin/create-delivery", {
        title: "Create New Delivery",
        delivery: {
          status: "pending",
          package: {
            description: "",
            category: "other",
            weight: 0,
            dimensions: {
              length: 0,
              width: 0,
              height: 0,
            },
            value: 0,
          },
          sender: {
            name: "",
            phone: "",
            email: "",
            address: {
              street: "",
              city: "",
              state: "",
              country: "United States",
              postalCode: "",
              coordinates: {
                type: "Point",
                coordinates: [0, 0],
              },
              fullAddress: "",
            },
          },
          receiver: {
            name: "",
            phone: "",
            email: "",
            address: {
              street: "",
              city: "",
              state: "",
              country: "United States",
              postalCode: "",
              coordinates: {
                type: "Point",
                coordinates: [0, 0],
              },
              fullAddress: "",
            },
            deliveryInstructions: "",
            signatureRequired: true,
          },
          estimatedDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000),
          trackingData: {
            active: false,
            currentLocation: {
              type: "Point",
              coordinates: [0, 0],
            },
            routeProgress: 0,
            speed: 0,
            bearing: 0,
          },
          geocoding: {
            provider: "mapbox",
            geocodingAttempts: 0,
          },
        },
        drivers,
        vehicles,
      });
    } catch (error) {
      console.error("Error in showCreateForm:", error);
      req.flash("error", "Failed to load create delivery form");
      res.redirect("/admin/deliveries");
    }
  };

  // Create delivery
  createDelivery = async (req, res) => {
    try {
      const deliveryData = req.body;

      // Set createdBy
      deliveryData.createdBy = req.user._id;

      // Process coordinates
      if (deliveryData.sender?.address?.coordinates) {
        deliveryData.sender.address.coordinates = {
          type: "Point",
          coordinates: [
            parseFloat(deliveryData.sender.address.coordinates[0]) || 0,
            parseFloat(deliveryData.sender.address.coordinates[1]) || 0,
          ],
        };
      }

      if (deliveryData.receiver?.address?.coordinates) {
        deliveryData.receiver.address.coordinates = {
          type: "Point",
          coordinates: [
            parseFloat(deliveryData.receiver.address.coordinates[0]) || 0,
            parseFloat(deliveryData.receiver.address.coordinates[1]) || 0,
          ],
        };
      }

      // Process package data
      if (deliveryData.package) {
        deliveryData.package.weight =
          parseFloat(deliveryData.package.weight) || 0;
        deliveryData.package.value =
          parseFloat(deliveryData.package.value) || 0;
        deliveryData.package.category =
          deliveryData.package.category || "other";

        if (deliveryData.package.dimensions) {
          deliveryData.package.dimensions.length =
            parseFloat(deliveryData.package.dimensions.length) || 0;
          deliveryData.package.dimensions.width =
            parseFloat(deliveryData.package.dimensions.width) || 0;
          deliveryData.package.dimensions.height =
            parseFloat(deliveryData.package.dimensions.height) || 0;
        }
      }

      // Create the delivery
      const delivery = new Delivery(deliveryData);
      await delivery.save();

      req.flash("success", "Delivery created successfully!");
      res.redirect("/admin/deliveries");
    } catch (error) {
      console.error("Error creating delivery:", error);

      if (error.name === "ValidationError") {
        const errors = Object.values(error.errors).map((err) => err.message);
        req.flash("error", errors.join(", "));
      } else if (error.code === 11000) {
        req.flash("error", "Tracking ID already exists");
      } else {
        req.flash("error", "Failed to create delivery");
      }

      return res.redirect("/admin/deliveries/create");
    }
  };

  // Get delivery details
  getDeliveryDetails = async (req, res) => {
    try {
      const { id } = req.params;

      let delivery = await Delivery.findById(id)
        .populate("createdBy", "name email")
        .populate("driver", "name phone email")
        .populate("vehicle", "plateNumber model");

      if (!delivery) {
        delivery = await Delivery.findOne({ trackingId: id })
          .populate("createdBy", "name email")
          .populate("driver", "name phone email")
          .populate("vehicle", "plateNumber model");
      }

      if (!delivery) {
        req.flash("error", "Delivery not found");
        return res.redirect("/admin/deliveries");
      }

      // Get available drivers and vehicles for dropdowns
      const [drivers, vehicles] = await Promise.all([
        Driver.find({ status: "active" }).select("_id name phone"),
        Vehicle.find({ status: "available" }).select("_id plateNumber model"),
      ]);

      res.render("admin/delivery-details", {
        title: `Delivery ${delivery.trackingId}`,
        delivery,
        drivers,
        vehicles,
        formatDate,
        getStatusColor,
        getSeverityColor,
      });
    } catch (error) {
      console.error("Error fetching delivery details:", error);
      req.flash("error", "Error fetching delivery: " + error.message);
      res.redirect("/admin/deliveries");
    }
  };

  // Update delivery (handles form submission from edit modal)
  updateDelivery = async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Find the delivery
      let delivery = await Delivery.findById(id);
      if (!delivery) {
        delivery = await Delivery.findOne({ trackingId: id });
      }

      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      // Process update data
      const processUpdate = (data) => {
        const result = {};
        for (const key in data) {
          if (data[key] !== undefined && data[key] !== "") {
            if (typeof data[key] === "object" && data[key] !== null) {
              result[key] = processUpdate(data[key]);
            } else {
              result[key] = data[key];
            }
          }
        }
        return result;
      };

      const cleanedData = processUpdate(updateData);

      // Handle special fields
      if (cleanedData.estimatedDelivery) {
        cleanedData.estimatedDelivery = new Date(cleanedData.estimatedDelivery);
      }

      if (cleanedData.sender?.address) {
        if (
          cleanedData.sender.address.coordinates &&
          Array.isArray(cleanedData.sender.address.coordinates)
        ) {
          cleanedData.sender.address.coordinates = {
            type: "Point",
            coordinates: cleanedData.sender.address.coordinates.map((coord) =>
              typeof coord === "string" ? parseFloat(coord) || 0 : coord
            ),
          };
        }
      }

      if (cleanedData.receiver?.address) {
        if (
          cleanedData.receiver.address.coordinates &&
          Array.isArray(cleanedData.receiver.address.coordinates)
        ) {
          cleanedData.receiver.address.coordinates = {
            type: "Point",
            coordinates: cleanedData.receiver.address.coordinates.map((coord) =>
              typeof coord === "string" ? parseFloat(coord) || 0 : coord
            ),
          };
        }
      }

      // Handle package dimensions
      if (cleanedData.package?.dimensions) {
        const dims = cleanedData.package.dimensions;
        if (dims.length || dims.width || dims.height) {
          cleanedData.package.dimensions = {
            length: parseFloat(dims.length) || 0,
            width: parseFloat(dims.width) || 0,
            height: parseFloat(dims.height) || 0,
          };
        }
      }

      // Convert numbers
      if (cleanedData.package?.weight) {
        cleanedData.package.weight = parseFloat(cleanedData.package.weight);
      }
      if (cleanedData.package?.value) {
        cleanedData.package.value = parseFloat(cleanedData.package.value);
      }

      // Update delivery
      Object.keys(cleanedData).forEach((key) => {
        if (key === "sender" || key === "receiver" || key === "package") {
          delivery[key] = { ...delivery[key], ...cleanedData[key] };
        } else {
          delivery[key] = cleanedData[key];
        }
      });

      delivery.updatedAt = new Date();
      delivery.updatedBy = req.user._id;

      await delivery.save();

      res.json({
        success: true,
        message: "Delivery updated successfully",
        delivery,
      });
    } catch (error) {
      console.error("Error updating delivery:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  // Update delivery status (handles status modal)
  updateDeliveryStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status, notes, ...otherData } = req.body;

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      // Update status
      delivery.status = status;

      // Handle special cases
      if (status === "delivered") {
        delivery.actualDelivery = new Date();
        delivery.trackingData.routeProgress = 100;
        delivery.trackingData.active = false;

        if (otherData.signatureReceived === "on") {
          delivery.signatureReceived = true;
        }

        // Resolve all incidents
        if (delivery.incidents && delivery.incidents.length > 0) {
          delivery.incidents.forEach((incident) => {
            if (!incident.resolved) {
              incident.resolved = true;
              incident.resolvedAt = new Date();
            }
          });
        }
      } else if (status === "in_transit") {
        delivery.trackingData.active = true;
        if (delivery.trackingData.routeProgress < 10) {
          delivery.trackingData.routeProgress = 10;
        }
      } else if (status === "cancelled") {
        delivery.cancellationReason = otherData.cancellationReason;
        delivery.trackingData.active = false;
        if (otherData.refundRequired === "on") {
          delivery.refundRequired = true;
        }
      } else if (status === "delayed") {
        delivery.delayInfo = {
          reason: otherData.delayReason || "Unknown",
          description: otherData.delayDescription || "",
          estimatedDelay: parseInt(otherData.estimatedDelay) || 30,
          reportedAt: new Date(),
        };
      }

      // Add status history
      if (!delivery.statusHistory) {
        delivery.statusHistory = [];
      }

      delivery.statusHistory.push({
        status,
        timestamp: new Date(),
        notes: notes || "",
        changedBy: req.user._id,
      });

      delivery.updatedAt = new Date();
      delivery.updatedBy = req.user._id;

      await delivery.save();

      res.json({
        success: true,
        message: `Delivery status updated to ${status}`,
        delivery,
      });
    } catch (error) {
      console.error("Error updating delivery status:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  // Add incident (handles incident modal) - FIXED
  addIncident = async (req, res) => {
    try {
      const { id } = req.params;
      const incidentData = req.body;

      console.log("Incident Data Received:", incidentData); // Debug log

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      // Validate required fields
      if (!incidentData.type || !incidentData.description) {
        return res.status(400).json({
          success: false,
          error: "Incident type and description are required",
        });
      }

      // Create incident object matching schema
      const incident = {
        type: incidentData.type,
        severity: incidentData.severity || "medium",
        description: incidentData.description,
        reportedAt: new Date(),
        estimatedDelay: parseInt(incidentData.estimatedDelay) || 0,
        emergencyServices: incidentData.emergencyServices === "on",
        resolved: false,
        reportedBy: req.user._id,
      };

      // Add address if provided
      if (incidentData.address) {
        incident.address = incidentData.address;
      }

      // Add location if coordinates provided
      if (incidentData.longitude && incidentData.latitude) {
        const lon = parseFloat(incidentData.longitude);
        const lat = parseFloat(incidentData.latitude);

        if (!isNaN(lon) && !isNaN(lat)) {
          incident.location = {
            type: "Point",
            coordinates: [lon, lat],
          };
        }
      }

      // Initialize incidents array if not exists
      if (!delivery.incidents) {
        delivery.incidents = [];
      }

      delivery.incidents.push(incident);

      // Update delivery status to delayed if incident reported
      if (delivery.status !== "delivered" && delivery.status !== "cancelled") {
        delivery.status = "delayed";

        // Set delay info
        delivery.delayInfo = {
          reason: incidentData.type || "incident",
          description: incidentData.description || "Incident reported",
          estimatedDelay: parseInt(incidentData.estimatedDelay) || 30,
          reportedAt: new Date(),
          location: incident.location,
        };
      }

      delivery.updatedAt = new Date();
      delivery.updatedBy = req.user._id;

      await delivery.save();

      res.json({
        success: true,
        message: "Incident reported successfully",
        incident,
      });
    } catch (error) {
      console.error("Error adding incident:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  // Update location (handles location modal) - FIXED
  updateLocation = async (req, res) => {
    try {
      const { id } = req.params;
      const { longitude, latitude, progress, speed, bearing, source } =
        req.body;

      console.log("Location Update Data:", { longitude, latitude }); // Debug log

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      // Validate and parse coordinates
      let lon, lat;

      // Handle different input formats
      if (typeof longitude === "string" && typeof latitude === "string") {
        lon = parseFloat(longitude.replace(/[^\d.-]/g, ""));
        lat = parseFloat(latitude.replace(/[^\d.-]/g, ""));
      } else {
        lon = parseFloat(longitude);
        lat = parseFloat(latitude);
      }

      console.log("Parsed coordinates:", { lon, lat }); // Debug log

      // Check if coordinates are valid numbers
      if (isNaN(lon) || isNaN(lat)) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid coordinates. Longitude and latitude must be valid numbers.",
        });
      }

      // Update location
      delivery.trackingData.currentLocation.coordinates = [lon, lat];

      // Update progress if provided
      if (progress !== undefined && progress !== null) {
        const progressNum = parseInt(progress);
        if (!isNaN(progressNum)) {
          delivery.trackingData.routeProgress = Math.min(
            100,
            Math.max(0, progressNum)
          );
        }
      }

      // Update speed and bearing if provided
      if (speed !== undefined && speed !== null) {
        const speedNum = parseFloat(speed);
        if (!isNaN(speedNum)) {
          delivery.trackingData.speed = speedNum;
        }
      }

      if (bearing !== undefined && bearing !== null) {
        const bearingNum = parseInt(bearing);
        if (!isNaN(bearingNum)) {
          delivery.trackingData.bearing = bearingNum;
        }
      }

      delivery.trackingData.lastUpdated = new Date();

      // Update source if provided
      if (source) {
        delivery.trackingData.source = source;
      }

      // If location is near destination, update progress
      const receiverCoords =
        delivery.receiver.address?.coordinates?.coordinates;
      if (
        receiverCoords &&
        receiverCoords[0] !== 0 &&
        receiverCoords[1] !== 0
      ) {
        const distance = this.calculateDistance([lon, lat], receiverCoords);

        // If within 100 meters, mark as near destination
        if (distance < 100 && delivery.trackingData.routeProgress < 95) {
          delivery.trackingData.routeProgress = 95;
        }
      }

      delivery.updatedAt = new Date();
      delivery.updatedBy = req.user._id;

      await delivery.save();

      res.json({
        success: true,
        message: "Location updated successfully",
        location: delivery.trackingData.currentLocation,
      });
    } catch (error) {
      console.error("Error updating location:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  // Assign driver (handles driver modal)
  assignDriver = async (req, res) => {
    try {
      const { id } = req.params;
      const { driverId, vehicleId, notes, notifyDriver } = req.body;

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      const updates = {};

      // Assign driver if provided
      if (driverId && driverId !== "null" && driverId !== "undefined") {
        const driver = await Driver.findById(driverId);
        if (!driver) {
          return res.status(404).json({
            success: false,
            error: "Driver not found",
          });
        }

        updates.driver = driverId;

        // If driver has a vehicle, assign it automatically if no vehicle specified
        if (driver.vehicle && !vehicleId) {
          updates.vehicle = driver.vehicle;
        }
      } else {
        // Remove driver assignment
        updates.driver = null;
      }

      // Assign vehicle if provided
      if (vehicleId && vehicleId !== "null" && vehicleId !== "undefined") {
        const vehicle = await Vehicle.findById(vehicleId);
        if (!vehicle) {
          return res.status(404).json({
            success: false,
            error: "Vehicle not found",
          });
        }

        // Check if vehicle is available
        if (vehicle.status !== "available" && vehicle.status !== "in_use") {
          return res.status(400).json({
            success: false,
            error: "Vehicle is not available",
          });
        }

        updates.vehicle = vehicleId;
      } else if (!driverId || driverId === "null" || driverId === "undefined") {
        // Remove vehicle assignment only if driver is also being removed
        updates.vehicle = null;
      }

      // Update delivery
      const updatedDelivery = await Delivery.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true }
      );

      // Update driver and vehicle status if assigned
      if (driverId && driverId !== "null" && driverId !== "undefined") {
        await Driver.findByIdAndUpdate(driverId, {
          $addToSet: { assignedDeliveries: id },
          status: "busy",
        });
      }

      if (vehicleId && vehicleId !== "null" && vehicleId !== "undefined") {
        await Vehicle.findByIdAndUpdate(vehicleId, {
          status: "in_use",
          $addToSet: { assignedDeliveries: id },
        });
      }

      res.json({
        success: true,
        message: "Driver assigned successfully",
        delivery: updatedDelivery,
      });
    } catch (error) {
      console.error("Error assigning driver:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  // Geocode addresses - FIXED to use model's geocoding method
  geocodeAddresses = async (req, res) => {
    try {
      const { id } = req.params;

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      // Use the model's geocoding method
      const results = await delivery.geocodeBothAddresses();

      res.json({
        success: true,
        message: "Addresses geocoded successfully",
        results: results.map((result) => ({
          type: result.addressType,
          success: result.success,
          error: result.error,
        })),
      });
    } catch (error) {
      console.error("Error geocoding addresses:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  // Mark delivery as delivered
  markAsDelivered = async (req, res) => {
    try {
      const { id } = req.params;

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      // Use the model's markAsDelivered method
      await delivery.markAsDelivered();

      res.json({
        success: true,
        message: "Delivery marked as delivered",
        delivery,
      });
    } catch (error) {
      console.error("Error marking delivery as delivered:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  // Cancel delivery
  cancelDelivery = async (req, res) => {
    try {
      const { id } = req.params;

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      // Check if delivery can be cancelled
      if (delivery.status === "delivered") {
        return res.status(400).json({
          success: false,
          error: "Cannot cancel a delivered delivery",
        });
      }

      // Update delivery status
      delivery.status = "cancelled";
      delivery.cancellationReason = req.body.reason || "Admin cancellation";
      delivery.trackingData.active = false;

      // Update driver and vehicle status
      if (delivery.driver) {
        await Driver.findByIdAndUpdate(delivery.driver, {
          $pull: { assignedDeliveries: id },
          status: "available",
        });
      }

      if (delivery.vehicle) {
        await Vehicle.findByIdAndUpdate(delivery.vehicle, {
          $pull: { assignedDeliveries: id },
          status: "available",
        });
      }

      delivery.updatedAt = new Date();
      delivery.updatedBy = req.user._id;
      await delivery.save();

      res.json({
        success: true,
        message: "Delivery cancelled successfully",
        delivery,
      });
    } catch (error) {
      console.error("Error cancelling delivery:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  // Resolve incident
  resolveIncident = async (req, res) => {
    try {
      const { id, incidentId } = req.params;

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      // Find the incident
      const incident = delivery.incidents.id(incidentId);
      if (!incident) {
        return res.status(404).json({
          success: false,
          error: "Incident not found",
        });
      }

      // Mark incident as resolved
      incident.resolved = true;
      incident.resolvedAt = new Date();

      // Check if all incidents are resolved
      const allResolved = delivery.incidents.every((inc) => inc.resolved);
      if (allResolved && delivery.status === "delayed") {
        // Revert to previous status or set to in_transit
        delivery.status = "in_transit";
        if (delivery.delayInfo) {
          delivery.delayInfo.resolvedAt = new Date();
        }
      }

      delivery.updatedAt = new Date();
      delivery.updatedBy = req.user._id;
      await delivery.save();

      res.json({
        success: true,
        message: "Incident resolved successfully",
        incident,
      });
    } catch (error) {
      console.error("Error resolving incident:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  // Delete delivery
  deleteDelivery = async (req, res) => {
    try {
      const { id } = req.params;

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      // Remove delivery from driver and vehicle assignments
      if (delivery.driver) {
        await Driver.findByIdAndUpdate(delivery.driver, {
          $pull: { assignedDeliveries: id },
        });
      }

      if (delivery.vehicle) {
        await Vehicle.findByIdAndUpdate(delivery.vehicle, {
          $pull: { assignedDeliveries: id },
        });
      }

      // Delete the delivery
      await Delivery.findByIdAndDelete(id);

      res.json({
        success: true,
        message: "Delivery deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting delivery:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  // Vehicle Management
  getAllVehicles = async (req, res) => {
    try {
      const vehicles = await Vehicle.find()
        .populate("driver", "name phone")
        .sort({ status: 1, model: 1 });

      res.render("admin/vehicles", {
        title: "Vehicle Management",
        vehicles,
        admin: req.user,
      });
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      req.flash("error", "Error loading vehicles");
      res.redirect("/admin");
    }
  };

  // Driver Management
  getAllDrivers = async (req, res) => {
    try {
      const drivers = await Driver.find()
        .populate("vehicle", "plateNumber model")
        .sort({ status: 1, name: 1 });

      res.render("admin/drivers", {
        title: "Driver Management",
        drivers,
        admin: req.user,
      });
    } catch (error) {
      console.error("Error fetching drivers:", error);
      req.flash("error", "Error loading drivers");
      res.redirect("/admin");
    }
  };

  // Helper function to calculate distance between coordinates
  calculateDistance(coord1, coord2) {
    const [lng1, lat1] = coord1;
    const [lng2, lat2] = coord2;

    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  // Helper function to geocode address (fallback if model method fails)
  async geocodeAddress(address) {
    try {
      // Using OpenStreetMap Nominatim (free service)
      const encodedAddress = encodeURIComponent(address);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;

      const response = await axios.get(url, {
        headers: {
          "User-Agent": "DeliveryManagementSystem/1.0",
        },
      });

      if (response.data && response.data.length > 0) {
        const { lat, lon } = response.data[0];
        return {
          success: true,
          coordinates: [parseFloat(lon), parseFloat(lat)],
        };
      }

      return {
        success: false,
        error: "Address not found",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = new AdminController();
