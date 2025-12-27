const { Delivery, Warehouse, Driver } = require("../models");
const mongoose = require("mongoose");
const axios = require("axios");
const DeliveryService = require("../services/deliveryService");
const {
  formatDate,
  getStatusColor,
  getSeverityColor,
} = require("../utils/helpers");

// Helper function to calculate coordinates by progress percentage for Mapbox
const calculateCoordinatesByProgress = async (delivery, progress) => {
  try {
    // Priority 1: Use Mapbox route geometry if available
    if (delivery.route?.geometry?.coordinates?.length > 0) {
      const coords = delivery.route.geometry.coordinates;
      const totalPoints = coords.length;
      const pointIndex = Math.floor((progress / 100) * (totalPoints - 1));
      return coords[Math.min(pointIndex, totalPoints - 1)];
    }

    // Priority 2: Use waypoints if available
    if (delivery.trackingData?.waypoints?.length > 0) {
      const totalWaypoints = delivery.trackingData.waypoints.length;
      const waypointIndex = Math.floor((progress / 100) * (totalWaypoints - 1));
      const waypoint =
        delivery.trackingData.waypoints[
          Math.min(waypointIndex, totalWaypoints - 1)
        ];
      if (waypoint?.coordinates) {
        return waypoint.coordinates;
      }
    }

    // Fallback: Linear interpolation between start and end
    const startCoords = delivery.sender?.address?.coordinates?.coordinates || [
      0, 0,
    ];
    const endCoords = delivery.receiver?.address?.coordinates?.coordinates || [
      0, 0,
    ];

    if (startCoords[0] === 0 && startCoords[1] === 0) {
      return null; // Can't calculate
    }
    if (endCoords[0] === 0 && endCoords[1] === 0) {
      return null; // Can't calculate
    }

    const percentage = progress / 100;
    const lon = startCoords[0] + (endCoords[0] - startCoords[0]) * percentage;
    const lat = startCoords[1] + (endCoords[1] - startCoords[1]) * percentage;

    return [lon, lat];
  } catch (error) {
    console.error("Error calculating coordinates by progress:", error);
    return null;
  }
};

// Optional: Calculate progress from coordinates (for reverse calculation)
const calculateProgressFromCoordinates = async (delivery, coordinates) => {
  try {
    const startCoords = delivery.sender?.address?.coordinates?.coordinates || [
      0, 0,
    ];
    const endCoords = delivery.receiver?.address?.coordinates?.coordinates || [
      0, 0,
    ];

    if (startCoords[0] === 0 && startCoords[1] === 0) {
      throw new Error("Sender coordinates not available");
    }
    if (endCoords[0] === 0 && endCoords[1] === 0) {
      throw new Error("Receiver coordinates not available");
    }

    // Calculate distance from start to current point
    const startToCurrent = haversineDistance(startCoords, coordinates);
    const startToEnd = haversineDistance(startCoords, endCoords);

    if (startToEnd === 0) return 0;

    const progress = (startToCurrent / startToEnd) * 100;
    return Math.min(100, Math.max(0, progress));
  } catch (error) {
    console.error("Error calculating progress from coordinates:", error);
    return delivery.trackingData?.vehicleProgress || 0;
  }
};

// Haversine distance calculation for Mapbox
const haversineDistance = (coord1, coord2) => {
  const toRad = (x) => (x * Math.PI) / 180;

  const R = 6371000; // Earth's radius in meters
  const φ1 = toRad(coord1[1]);
  const φ2 = toRad(coord2[1]);
  const Δφ = toRad(coord2[1] - coord1[1]);
  const Δλ = toRad(coord2[0] - coord1[0]);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

class AdminController {
  // Dashboard - Updated to use warehouses
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
      res.render("admin/dashboard", {
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
        .populate("warehouse", "name code")
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

    // Get warehouse count
    const warehouseCount = await Warehouse.countDocuments();

    return {
      stats: {
        activeDeliveries,
        todayDeliveries,
        deliveriesChange,
        pendingDeliveries,
        delayedDeliveries,
        warehouseCount,
      },
      recentActivities,
    };
  }

  // Admin delivery list - Updated to use warehouses
  listDeliveries = async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        search,
        driver,
        warehouse,
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

      if (warehouse && warehouse !== "all") {
        if (mongoose.Types.ObjectId.isValid(warehouse)) {
          query.warehouse = warehouse;
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
        .populate("warehouse", "name code")
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

      // Get available drivers and warehouses for filter dropdowns
      const [drivers, warehouses] = await Promise.all([
        Driver.find({ status: { $in: ["active", "available"] } }).select(
          "name _id"
        ),
        Warehouse.find().select("name _id code"),
      ]);

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
          warehouse,
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
        currentFilters: { status, search, driver, warehouse, date, category },
        drivers,
        warehouses,
      });
    } catch (error) {
      console.error("Error fetching deliveries:", error);
      req.flash("error", "Error fetching deliveries: " + error.message);
      res.redirect("/admin");
    }
  };

  // Show create form - Updated to use warehouses
  showCreateForm = async (req, res) => {
    try {
      const [drivers, warehouses] = await Promise.all([
        Driver.find({ status: { $in: ["active", "available"] } }).select(
          "_id name phone"
        ),
        Warehouse.find().select("_id name code location"),
      ]);

      // Convert warehouse coordinates to string for form input
      const warehousesWithCoords = warehouses.map((warehouse) => ({
        ...warehouse.toObject(),
        coordinatesString: warehouse.location.coordinates.join(","),
      }));

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
        warehouses: warehousesWithCoords,
      });
    } catch (error) {
      console.error("Error in showCreateForm:", error);
      req.flash("error", "Failed to load create delivery form");
      res.redirect("/admin/deliveries");
    }
  };

  // Create delivery - Updated to use warehouses
  createDelivery = async (req, res) => {
    try {
      const deliveryData = req.body;

      // Auto-generate trackingId if not provided
      if (!deliveryData.trackingId || deliveryData.trackingId.trim() === "") {
        // Generate a unique tracking ID
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        deliveryData.trackingId = `DEL-${timestamp}-${random}`;
      }

      // Set createdBy
      deliveryData.createdBy = req.user._id;

      // Handle checkbox - convert string to boolean
      if (deliveryData.receiver?.signatureRequired !== undefined) {
        deliveryData.receiver.signatureRequired =
          deliveryData.receiver.signatureRequired === "true" ||
          deliveryData.receiver.signatureRequired === true;
      }

      // Handle empty driver/warehouse - set to null
      if (deliveryData.driver === "" || !deliveryData.driver) {
        deliveryData.driver = null;
      }

      if (deliveryData.warehouse === "" || !deliveryData.warehouse) {
        deliveryData.warehouse = null;
      }

      // Process coordinates for sender
      if (deliveryData.sender?.address?.coordinates?.coordinates) {
        const senderLng =
          parseFloat(deliveryData.sender.address.coordinates.coordinates[0]) ||
          0;
        const senderLat =
          parseFloat(deliveryData.sender.address.coordinates.coordinates[1]) ||
          0;

        deliveryData.sender.address.coordinates = {
          type: "Point",
          coordinates: [senderLng, senderLat],
        };

        // Set geocoding metadata for sender
        deliveryData.sender.address.geocoded =
          senderLng !== 0 && senderLat !== 0;
        deliveryData.sender.address.lastGeocodedAt = new Date();
      } else {
        // Default sender coordinates if not provided
        deliveryData.sender.address.coordinates = {
          type: "Point",
          coordinates: [0, 0],
        };
        deliveryData.sender.address.geocoded = false;
      }

      // Process coordinates for receiver
      if (deliveryData.receiver?.address?.coordinates?.coordinates) {
        const receiverLng =
          parseFloat(
            deliveryData.receiver.address.coordinates.coordinates[0]
          ) || 0;
        const receiverLat =
          parseFloat(
            deliveryData.receiver.address.coordinates.coordinates[1]
          ) || 0;

        deliveryData.receiver.address.coordinates = {
          type: "Point",
          coordinates: [receiverLng, receiverLat],
        };

        // Set geocoding metadata for receiver
        deliveryData.receiver.address.geocoded =
          receiverLng !== 0 && receiverLat !== 0;
        deliveryData.receiver.address.lastGeocodedAt = new Date();
      } else {
        // Default receiver coordinates if not provided
        deliveryData.receiver.address.coordinates = {
          type: "Point",
          coordinates: [0, 0],
        };
        deliveryData.receiver.address.geocoded = false;
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
          if (deliveryData.package.dimensions.length) {
            deliveryData.package.dimensions.length = parseFloat(
              deliveryData.package.dimensions.length
            );
          }
          if (deliveryData.package.dimensions.width) {
            deliveryData.package.dimensions.width = parseFloat(
              deliveryData.package.dimensions.width
            );
          }
          if (deliveryData.package.dimensions.height) {
            deliveryData.package.dimensions.height = parseFloat(
              deliveryData.package.dimensions.height
            );
          }

          // Remove dimensions if all values are falsy
          if (
            !deliveryData.package.dimensions.length &&
            !deliveryData.package.dimensions.width &&
            !deliveryData.package.dimensions.height
          ) {
            delete deliveryData.package.dimensions;
          }
        }
      }

      // Initialize tracking data - start from warehouse if assigned
      let startingCoordinates = [0, 0];
      if (deliveryData.warehouse) {
        const warehouse = await Warehouse.findById(deliveryData.warehouse);
        if (warehouse && warehouse.location && warehouse.location.coordinates) {
          startingCoordinates = warehouse.location.coordinates;
        }
      }

      deliveryData.trackingData = {
        active: false,
        currentLocation: {
          type: "Point",
          coordinates: startingCoordinates,
        },
        routeProgress: 0,
        lastUpdated: new Date(),
        speed: 0,
        bearing: 0,
      };

      // Initialize route data
      deliveryData.route = {
        mapboxDirections: null,
        totalDistance: 0,
        totalDuration: 0,
        geometry: null,
        bounds: null,
        legs: [],
        optimized: false,
      };

      // Initialize incidents array
      deliveryData.incidents = [];

      // Initialize history
      deliveryData.history = [
        {
          action: "created",
          description: `Delivery created with tracking ID: ${deliveryData.trackingId}`,
          timestamp: new Date(),
          user: req.user._id,
        },
      ];

      // Initialize geocoding data
      deliveryData.geocoding = {
        provider: "mapbox",
        lastGeocodedAt: new Date(),
        geocodingAttempts: 0,
      };

      // Set updatedBy
      deliveryData.updatedBy = req.user._id;

      // Create the delivery
      const delivery = new Delivery(deliveryData);
      await delivery.save();

      req.flash(
        "success",
        `Delivery created successfully! Tracking ID: ${delivery.trackingId}`
      );
      res.redirect("/admin/deliveries");
    } catch (error) {
      console.error("Error creating delivery:", error);

      if (error.name === "ValidationError") {
        const errors = Object.values(error.errors).map((err) => err.message);
        req.flash("error", `Validation Error: ${errors.join(", ")}`);
      } else if (error.code === 11000) {
        req.flash(
          "error",
          "Tracking ID already exists. Please try again or use a different ID."
        );
      } else {
        req.flash("error", `Failed to create delivery: ${error.message}`);
      }

      // Return with form data to repopulate form
      const drivers = await Driver.find({
        status: { $in: ["active", "available"] },
      });
      const warehouses = await Warehouse.find();

      return res.render("admin/create-delivery", {
        title: "Create Delivery",
        drivers,
        warehouses: warehouses.map((w) => ({
          ...w.toObject(),
          coordinatesString: w.location.coordinates.join(","),
        })),
        formData: req.body, // Pass back form data
        errors: req.flash("error"),
      });
    }
  };

  // Get delivery details - Updated for warehouses
  getDeliveryDetails = async (req, res) => {
    try {
      const { id } = req.params;

      // 1. Find delivery by _id or trackingId
      let delivery = await Delivery.findOne({
        $or: [{ _id: id }, { trackingId: id }],
      })
        .populate("createdBy", "name email")
        .populate("driver", "name phone email status")
        .populate("warehouse", "name code location");

      if (!delivery) {
        req.flash("error", "Delivery not found");
        return res.redirect("/admin/deliveries");
      }

      // 2. Sort incidents (newest → oldest)
      if (Array.isArray(delivery.incidents)) {
        delivery.incidents.sort((a, b) => {
          const dateA = a.reportedAt ? new Date(a.reportedAt) : 0;
          const dateB = b.reportedAt ? new Date(b.reportedAt) : 0;
          return dateB - dateA;
        });
      }

      // 3. Fetch drivers & warehouses for assignment dropdowns
      const [drivers, warehouses] = await Promise.all([
        Driver.find({
          status: { $in: ["active", "available", "on_delivery"] },
        })
          .select("_id name phone email status")
          .lean(),

        Warehouse.find().select("_id name code location").lean(),
      ]);

      // Format coordinates for display
      if (delivery.warehouse && delivery.warehouse.location) {
        delivery.warehouse.coordinatesString =
          delivery.warehouse.location.coordinates.join(", ");
      }

      // 4. Render page
      res.render("admin/delivery-details", {
        title: `Delivery ${delivery.trackingId}`,
        delivery: delivery.toObject(),
        drivers,
        warehouses,
        formatDate,
        getStatusColor,
        getSeverityColor,
      });
    } catch (error) {
      console.error("Error fetching delivery details:", error);
      req.flash("error", `Error fetching delivery: ${error.message}`);
      res.redirect("/admin/deliveries");
    }
  };

  // Update delivery - Updated for warehouses
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
          if (data[key] !== undefined) {
            if (
              typeof data[key] === "object" &&
              data[key] !== null &&
              !Array.isArray(data[key])
            ) {
              const nested = processUpdate(data[key]);
              if (Object.keys(nested).length > 0) {
                result[key] = nested;
              }
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

      // Handle checkbox for signatureRequired
      if (
        cleanedData.receiver &&
        typeof cleanedData.receiver.signatureRequired === "boolean"
      ) {
        // Already boolean from AJAX request
      }

      // Handle package dimensions
      if (cleanedData.package && cleanedData.package.dimensions) {
        const dims = cleanedData.package.dimensions;

        // Check if any dimension was provided
        const hasDimensions =
          dims.length !== undefined ||
          dims.width !== undefined ||
          dims.height !== undefined;

        if (hasDimensions) {
          cleanedData.package.dimensions = {
            length: parseFloat(dims.length) || 0,
            width: parseFloat(dims.width) || 0,
            height: parseFloat(dims.height) || 0,
          };
        } else {
          delete cleanedData.package.dimensions;
        }
      }

      // Convert numeric fields
      if (cleanedData.package) {
        if (cleanedData.package.weight !== undefined) {
          cleanedData.package.weight =
            parseFloat(cleanedData.package.weight) || 0;
        }
        if (cleanedData.package.value !== undefined) {
          cleanedData.package.value =
            parseFloat(cleanedData.package.value) || 0;
        }
      }

      // Update delivery with cleaned data
      Object.keys(cleanedData).forEach((key) => {
        if (key === "sender" || key === "receiver" || key === "package") {
          delivery[key] = { ...delivery[key].toObject(), ...cleanedData[key] };
        } else {
          delivery[key] = cleanedData[key];
        }
      });

      // Update timestamps and user
      delivery.updatedAt = new Date();
      delivery.updatedBy = req.user._id;

      await delivery.save();

      // Always return JSON for AJAX requests
      return res.json({
        success: true,
        message: "Delivery updated successfully",
        delivery,
      });
    } catch (error) {
      console.error("Error updating delivery:", error);

      // Return JSON error for AJAX requests
      return res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
      });
    }
  };

  // Update delivery status - Updated for warehouses
  updateDeliveryStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      console.log("API Update request for ID:", id);
      console.log("Update data:", updateData);

      // Find the delivery
      let delivery = await Delivery.findById(id);
      if (!delivery) {
        delivery = await Delivery.findOne({ trackingId: id });
      }

      if (!delivery) {
        console.log("Delivery not found for ID:", id);
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      // Helper function to clean update data
      const cleanUpdateData = (data) => {
        const cleaned = {};

        for (const key in data) {
          if (data[key] !== undefined && data[key] !== null) {
            if (typeof data[key] === "object" && !Array.isArray(data[key])) {
              const nested = cleanUpdateData(data[key]);
              if (Object.keys(nested).length > 0) {
                cleaned[key] = nested;
              }
            } else if (data[key] !== "") {
              // Only skip empty strings for non-required fields
              cleaned[key] = data[key];
            }
          }
        }
        return cleaned;
      };

      const cleanedData = cleanUpdateData(updateData);
      console.log("Cleaned data:", cleanedData);

      // Handle special fields
      if (cleanedData.estimatedDelivery) {
        cleanedData.estimatedDelivery = new Date(cleanedData.estimatedDelivery);
        if (isNaN(cleanedData.estimatedDelivery)) {
          return res.status(400).json({
            success: false,
            error: "Invalid date format for estimatedDelivery",
          });
        }
      }

      // Handle checkbox boolean conversion
      if (cleanedData.receiver?.signatureRequired !== undefined) {
        cleanedData.receiver.signatureRequired =
          cleanedData.receiver.signatureRequired === "true" ||
          cleanedData.receiver.signatureRequired === true;
      }

      // Handle package dimensions
      if (cleanedData.package?.dimensions) {
        const dims = cleanedData.package.dimensions;
        cleanedData.package.dimensions = {
          length: parseFloat(dims.length) || 0,
          width: parseFloat(dims.width) || 0,
          height: parseFloat(dims.height) || 0,
        };
      }

      // Convert numeric fields
      if (cleanedData.package?.weight) {
        cleanedData.package.weight = parseFloat(cleanedData.package.weight);
        if (
          isNaN(cleanedData.package.weight) ||
          cleanedData.package.weight <= 0
        ) {
          return res.status(400).json({
            success: false,
            error: "Package weight must be a positive number",
          });
        }
      }

      if (cleanedData.package?.value) {
        cleanedData.package.value = parseFloat(cleanedData.package.value);
        if (isNaN(cleanedData.package.value) || cleanedData.package.value < 0) {
          cleanedData.package.value = 0;
        }
      }

      // Merge the updates - handle nested objects properly
      const mergeObjects = (target, source) => {
        for (const key in source) {
          if (
            source[key] &&
            typeof source[key] === "object" &&
            !Array.isArray(source[key])
          ) {
            if (!target[key]) target[key] = {};
            mergeObjects(target[key], source[key]);
          } else {
            target[key] = source[key];
          }
        }
      };

      // Create a copy of delivery to merge into
      const deliveryObj = delivery.toObject();
      mergeObjects(deliveryObj, cleanedData);

      // Update the document
      delivery.set(deliveryObj);

      // Update metadata
      delivery.updatedAt = new Date();
      if (req.user && req.user._id) {
        delivery.updatedBy = req.user._id;
      }

      // Save changes
      await delivery.save();

      console.log("Delivery updated successfully:", delivery._id);

      // Return success response
      return res.json({
        success: true,
        message: "Delivery updated successfully",
        delivery: {
          _id: delivery._id,
          trackingId: delivery.trackingId,
          status: delivery.status,
          estimatedDelivery: delivery.estimatedDelivery,
          sender: delivery.sender,
          receiver: delivery.receiver,
          package: delivery.package,
        },
      });
    } catch (error) {
      console.error("API Error updating delivery:", error);

      // Handle Mongoose validation errors
      if (error.name === "ValidationError") {
        const errors = {};
        Object.keys(error.errors).forEach((key) => {
          errors[key] = error.errors[key].message;
        });

        return res.status(400).json({
          success: false,
          error: "Validation failed",
          errors,
        });
      }

      // Handle duplicate key error
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          error: "Duplicate key error",
          field: Object.keys(error.keyPattern)[0],
        });
      }

      // Generic server error
      return res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
      });
    }
  };

  // Add incident - Updated for warehouses
  addIncident = async (req, res) => {
    try {
      console.log("=== BACKEND STARTING ===");
      console.log("Request body:", req.body);

      const { id } = req.params;
      const incidentData = req.body;

      // Find delivery
      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      // Validate required fields
      if (
        !incidentData.type ||
        !incidentData.severity ||
        !incidentData.description
      ) {
        return res.status(400).json({
          success: false,
          error: "Type, severity, and description are required",
        });
      }

      // Create incident object
      const incident = {
        type: incidentData.type,
        severity: incidentData.severity,
        description: incidentData.description.trim(),
        reportedAt: new Date(),
        estimatedDelay: parseInt(incidentData.estimatedDelay) || 30,
        emergencyServices: incidentData.emergencyServices === "on",
        resolved: false,
        reportedBy: req.user._id,
        driverInvolved: incidentData.driverInvolved === "on",
        packageAffected: incidentData.packageAffected === "on",
      };

      // Add optional fields
      if (incidentData.address) incident.address = incidentData.address.trim();
      if (incidentData.policeReport)
        incident.policeReport = incidentData.policeReport.trim();

      // Add additional details
      incident.additionalDetails = {};
      if (incidentData.otherParties)
        incident.additionalDetails.otherParties = incidentData.otherParties;
      if (incidentData.vehicleIssue)
        incident.additionalDetails.vehicleIssue = incidentData.vehicleIssue;
      if (incidentData.towRequired)
        incident.additionalDetails.towRequired =
          incidentData.towRequired === "yes";
      if (incidentData.damageType)
        incident.additionalDetails.damageType = incidentData.damageType;
      if (incidentData.valueLoss)
        incident.additionalDetails.valueLoss =
          parseInt(incidentData.valueLoss) || 0;
      if (incidentData.theftTime)
        incident.additionalDetails.theftTime = new Date(incidentData.theftTime);

      // Add to delivery
      if (!delivery.incidents) delivery.incidents = [];
      delivery.incidents.push(incident);

      // Update delivery status if needed
      if (
        incidentData.severity !== "low" &&
        delivery.status !== "delivered" &&
        delivery.status !== "cancelled"
      ) {
        delivery.status = "delayed";
        delivery.delayInfo = {
          reason: incidentData.type,
          description: incidentData.description.substring(0, 100),
          estimatedDelay: parseInt(incidentData.estimatedDelay) || 30,
          reportedAt: new Date(),
        };
        if (incident.address) {
          delivery.delayInfo.address = incident.address;
        }
      }

      // Add history
      if (!delivery.history) delivery.history = [];
      delivery.history.push({
        action: "incident_reported",
        description: `${incidentData.type} incident reported`,
        details: {
          severity: incidentData.severity,
          estimatedDelay: incident.estimatedDelay,
        },
        user: req.user._id,
        timestamp: new Date(),
      });

      delivery.updatedAt = new Date();
      delivery.updatedBy = req.user._id;

      await delivery.save();

      console.log("Incident saved successfully");

      // ALWAYS return JSON
      return res.json({
        success: true,
        message: "Incident reported successfully",
        deliveryId: delivery._id,
        incident: incident,
      });
    } catch (error) {
      console.error("Error adding incident:", error);

      // ALWAYS return JSON even for errors
      return res.status(500).json({
        success: false,
        error: error.message || "An unexpected error occurred",
      });
    }
  };

  // Delete incident
  deleteIncident = async (req, res) => {
    try {
      const { id, incidentIndex } = req.params;

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      // Check if incident exists
      if (!delivery.incidents || incidentIndex >= delivery.incidents.length) {
        return res.status(404).json({
          success: false,
          error: "Incident not found",
        });
      }

      // Get incident before deleting for logging
      const deletedIncident = delivery.incidents[incidentIndex];

      // Remove the incident
      delivery.incidents.splice(incidentIndex, 1);

      // Add to history
      delivery.history.push({
        action: "incident_deleted",
        description: `${deletedIncident.type} incident deleted`,
        details: {
          severity: deletedIncident.severity,
          reportedAt: deletedIncident.reportedAt,
        },
        user: req.user._id,
        timestamp: new Date(),
      });

      await delivery.save();

      req.flash("success", "Incident deleted successfully");
      res.redirect(`/admin/deliveries/${delivery._id}`);
    } catch (error) {
      console.error("Error deleting incident:", error);
      req.flash("error", `Error deleting incident: ${error.message}`);
      res.redirect(`/admin/deliveries/${id}`);
    }
  };
  // Update location - Dual progress system for Mapbox integration
  updateLocation = async (req, res) => {
    try {
      const { id } = req.params;
      const {
        longitude,
        latitude,
        vehicleProgress, // Controls actual map position
        routeProgress, // Independent display percentage
        speed,
        bearing,
        source,
        accuracy,
        updateMap,
        notifyCustomer,
      } = req.body;

      console.log("Location Update Data:", {
        id,
        longitude,
        latitude,
        vehicleProgress,
        routeProgress,
        source,
        accuracy,
      });

      // Validate required fields
      if (!id) {
        return res.status(400).json({
          success: false,
          error: "Delivery ID is required",
        });
      }

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      // Check if delivery can be updated
      if (delivery.status === "delivered" || delivery.status === "cancelled") {
        return res.status(400).json({
          success: false,
          error: `Cannot update location for a ${delivery.status} delivery`,
        });
      }

      // Initialize trackingData if not exists
      if (!delivery.trackingData) {
        delivery.trackingData = {
          active: false,
          currentLocation: {
            type: "Point",
            coordinates: [0, 0],
          },
          routeProgress: 0,
          vehicleProgress: 0,
          lastUpdated: new Date(),
          speed: 0,
          bearing: 0,
          waypoints: [],
        };
      }

      // ===== VEHICLE PROGRESS LOGIC =====
      // This controls the actual map position for Mapbox
      let calculatedVehicleProgress =
        delivery.trackingData.vehicleProgress || 0;
      let calculatedCoordinates = delivery.trackingData.currentLocation
        .coordinates || [0, 0];

      // Parse vehicleProgress if provided
      if (
        vehicleProgress !== undefined &&
        vehicleProgress !== null &&
        vehicleProgress !== ""
      ) {
        const vehicleProgressNum = parseInt(vehicleProgress);
        if (!isNaN(vehicleProgressNum)) {
          calculatedVehicleProgress = Math.min(
            100,
            Math.max(0, vehicleProgressNum)
          );

          // Calculate coordinates based on vehicleProgress for Mapbox
          // This is what moves the vehicle on the map
          const coords = await calculateCoordinatesByProgress(
            delivery,
            calculatedVehicleProgress
          );
          if (coords && coords[0] !== 0 && coords[1] !== 0) {
            calculatedCoordinates = coords;
          }
        }
      } else if (longitude && latitude) {
        // If coordinates provided directly (for manual updates)
        calculatedCoordinates = [parseFloat(longitude), parseFloat(latitude)];
        // Optionally calculate vehicleProgress from these coordinates
        // calculatedVehicleProgress = await calculateProgressFromCoordinates(delivery, calculatedCoordinates);
      }

      // ===== ROUTE PROGRESS LOGIC =====
      // This is completely independent - just for display
      let calculatedRouteProgress = delivery.trackingData.routeProgress || 0;

      if (
        routeProgress !== undefined &&
        routeProgress !== null &&
        routeProgress !== ""
      ) {
        const routeProgressNum = parseInt(routeProgress);
        if (!isNaN(routeProgressNum)) {
          calculatedRouteProgress = Math.min(
            100,
            Math.max(0, routeProgressNum)
          );
        }
      }

      // ===== UPDATE DELIVERY TRACKING DATA =====
      // Vehicle progress controls map position
      delivery.trackingData.vehicleProgress = calculatedVehicleProgress;

      // Route progress is independent display
      delivery.trackingData.routeProgress = calculatedRouteProgress;

      // Current location is determined by VEHICLE PROGRESS only
      delivery.trackingData.currentLocation.coordinates = calculatedCoordinates;
      delivery.trackingData.lastUpdated = new Date();

      // Update speed if provided
      if (speed !== undefined && speed !== null && speed !== "") {
        const speedNum = parseFloat(speed);
        if (!isNaN(speedNum)) {
          delivery.trackingData.speed = Math.max(0, speedNum);
        }
      }

      // Update bearing if provided
      if (bearing !== undefined && bearing !== null && bearing !== "") {
        const bearingNum = parseInt(bearing);
        if (!isNaN(bearingNum)) {
          // Normalize bearing to 0-360 degrees
          delivery.trackingData.bearing = ((bearingNum % 360) + 360) % 360;
        }
      }

      // Update source if provided
      if (source) {
        delivery.trackingData.source = source;
      }

      // Update accuracy if provided
      if (accuracy) {
        if (!delivery.trackingData.metadata) {
          delivery.trackingData.metadata = {};
        }
        delivery.trackingData.metadata.accuracy = accuracy;
      }

      // ===== WAYPOINT UPDATES BASED ON VEHICLE PROGRESS =====
      // Only vehicle progress affects waypoints (map position)
      if (
        delivery.trackingData.waypoints &&
        delivery.trackingData.waypoints.length > 0
      ) {
        const totalWaypoints = delivery.trackingData.waypoints.length;
        const waypointsPerPercent = 100 / totalWaypoints;
        const completedWaypoints = Math.floor(
          calculatedVehicleProgress / waypointsPerPercent
        );

        delivery.trackingData.waypoints.forEach((waypoint, index) => {
          if (index <= completedWaypoints - 1 && !waypoint.arrived) {
            waypoint.arrived = true;
            waypoint.timestamp = new Date();
          }
        });
      }

      // Calculate remaining distance based on VEHICLE PROGRESS only
      if (delivery.route?.totalDistance) {
        const remainingPercentage = (100 - calculatedVehicleProgress) / 100;
        delivery.trackingData.remainingDistance = Math.round(
          delivery.route.totalDistance * remainingPercentage
        );
      }

      // Calculate ETA based on speed and remaining distance (vehicle progress)
      if (
        delivery.trackingData.speed > 0 &&
        delivery.trackingData.remainingDistance > 0
      ) {
        const remainingHours =
          delivery.trackingData.remainingDistance /
          1000 /
          delivery.trackingData.speed;
        delivery.trackingData.estimatedArrival = new Date(
          Date.now() + remainingHours * 60 * 60 * 1000
        );
      }

      // Update delivery status based on VEHICLE PROGRESS only (actual position)
      if (delivery.status === "pending" && calculatedVehicleProgress > 0) {
        delivery.status = "in_transit";
        delivery.trackingData.active = true;
      }

      // If vehicle is near destination (95%+), update status
      if (calculatedVehicleProgress >= 95 && delivery.status !== "delivered") {
        delivery.status = "out_for_delivery";
      }

      // If at 100%, mark as delivered
      if (calculatedVehicleProgress >= 100 && delivery.status !== "delivered") {
        delivery.status = "delivered";
        delivery.actualDelivery = new Date();
        delivery.trackingData.active = false;
      }

      // Update timestamps and user info
      delivery.updatedAt = new Date();
      delivery.updatedBy = req.user ? req.user._id : null;

      // Add to update log
      if (!delivery.updateLog) {
        delivery.updateLog = [];
      }

      delivery.updateLog.push({
        action: "location_update",
        timestamp: new Date(),
        coordinates: delivery.trackingData.currentLocation.coordinates,
        vehicleProgress: calculatedVehicleProgress,
        routeProgress: calculatedRouteProgress,
        updatedBy: req.user ? req.user._id : null,
        source: source || "manual",
      });

      // Save the delivery
      await delivery.save();

      // If notifyCustomer is true, send notification
      if (notifyCustomer === "true" || notifyCustomer === true) {
        console.log(
          `Notification sent to customer for delivery ${delivery.trackingId}`
        );

        if (!delivery.notifications) {
          delivery.notifications = [];
        }

        delivery.notifications.push({
          type: "location_update",
          sentAt: new Date(),
          recipient: delivery.receiver.email,
          status: "sent",
          vehicleProgress: calculatedVehicleProgress,
          routeProgress: calculatedRouteProgress,
        });

        await delivery.save();
      }

      // Prepare response data
      const responseData = {
        success: true,
        message: "Location updated successfully",
        tracking: {
          vehicleProgress: delivery.trackingData.vehicleProgress,
          routeProgress: delivery.trackingData.routeProgress,
          currentLocation: delivery.trackingData.currentLocation,
          speed: delivery.trackingData.speed,
          bearing: delivery.trackingData.bearing,
          remainingDistance: delivery.trackingData.remainingDistance,
          estimatedArrival: delivery.trackingData.estimatedArrival,
          lastUpdated: delivery.trackingData.lastUpdated,
        },
        delivery: {
          _id: delivery._id,
          trackingId: delivery.trackingId,
          status: delivery.status,
        },
      };

      // If updateMap is true, trigger map update for Mapbox
      if (updateMap === "true" || updateMap === true) {
        console.log(
          `Mapbox update triggered for delivery ${delivery.trackingId}`
        );
        responseData.mapUpdate = {
          triggered: true,
          timestamp: new Date(),
          coordinates: delivery.trackingData.currentLocation.coordinates,
          vehicleProgress: delivery.trackingData.vehicleProgress,
        };
      }

      res.json(responseData);
    } catch (error) {
      console.error("Error updating location:", error);

      if (error.name === "ValidationError") {
        const errors = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json({
          success: false,
          error: "Validation error",
          details: errors,
        });
      }

      res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
      });
    }
  };

  // Assign driver and warehouse - Updated for warehouses
  assignDriver = async (req, res) => {
    try {
      const { id } = req.params;
      const { driverId, warehouseId } = req.body;

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      const previousDriverId = delivery.driver?.toString();
      const previousWarehouseId = delivery.warehouse?.toString();

      const updates = {};

      /* ---------------- DRIVER HANDLING ---------------- */

      if (driverId && driverId !== "null" && driverId !== "undefined") {
        const driver = await Driver.findById(driverId);
        if (!driver) {
          return res.status(404).json({
            success: false,
            error: "Driver not found",
          });
        }

        // Check if driver is available
        if (driver.status === "off_duty" || driver.status === "break") {
          return res.status(400).json({
            success: false,
            error: `Driver is currently ${driver.status.replace(
              "_",
              " "
            )} and cannot be assigned`,
          });
        }

        updates.driver = driverId;

        // Auto-assign driver's current warehouse if none selected
        if (!warehouseId || warehouseId === "") {
          // Drivers no longer have assigned vehicles, so we don't auto-assign warehouses
        }
      } else if (driverId === "" || driverId === null) {
        updates.driver = null;
      }

      /* ---------------- WAREHOUSE HANDLING ---------------- */

      if (
        warehouseId &&
        warehouseId !== "null" &&
        warehouseId !== "undefined"
      ) {
        const warehouse = await Warehouse.findById(warehouseId);
        if (!warehouse) {
          return res.status(404).json({
            success: false,
            error: "Warehouse not found",
          });
        }

        updates.warehouse = warehouseId;

        // Update tracking starting location to warehouse location
        if (warehouse.location && warehouse.location.coordinates) {
          delivery.trackingData.currentLocation.coordinates =
            warehouse.location.coordinates;
        }
      } else if (warehouseId === "" || warehouseId === null) {
        updates.warehouse = null;
      }

      /* ---------------- RELEASE PREVIOUS ASSIGNMENTS ---------------- */

      // Only release driver if we're changing it
      if (updates.driver !== undefined) {
        if (previousDriverId && previousDriverId !== updates.driver) {
          await Driver.findByIdAndUpdate(previousDriverId, {
            $pull: { currentDeliveries: id },
            status: "available",
          });
        }
      }

      // No need to release warehouse as they don't track assigned deliveries

      /* ---------------- UPDATE DELIVERY ---------------- */

      const updatedDelivery = await Delivery.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true }
      )
        .populate("driver", "name phone email")
        .populate("warehouse", "name code location");

      /* ---------------- ASSIGN NEW DRIVER / WAREHOUSE ---------------- */

      if (updates.driver && updates.driver !== null) {
        await Driver.findByIdAndUpdate(updates.driver, {
          $addToSet: { currentDeliveries: id },
          status: "on_delivery",
        });
      }

      res.json({
        success: true,
        message: "Assignment updated successfully",
        delivery: updatedDelivery,
      });
    } catch (error) {
      console.error("Error assigning driver and warehouse:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  // Geocode addresses
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

  // Cancel delivery - Updated for warehouses
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

      // Update driver status only
      if (delivery.driver) {
        await Driver.findByIdAndUpdate(delivery.driver, {
          $pull: { currentDeliveries: id },
          status: "available",
        });
      }

      // Warehouses don't need to be updated as they don't track deliveries

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
      const { resolutionNotes } = req.body;

      console.log("Resolving incident:", {
        deliveryId: id,
        incidentId,
        resolutionNotes,
      });

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        req.flash("error", "Delivery not found");
        return res.redirect("/admin/deliveries");
      }

      // Check if delivery has incidents
      if (
        !delivery.incidents ||
        !Array.isArray(delivery.incidents) ||
        delivery.incidents.length === 0
      ) {
        req.flash("error", "No incidents found for this delivery");
        return res.redirect(`/admin/deliveries/${id}`);
      }

      // Find incident by ID
      const incident = delivery.incidents.find(
        (inc) => inc._id && inc._id.toString() === incidentId
      );

      if (!incident) {
        req.flash("error", "Incident not found");
        return res.redirect(`/admin/deliveries/${id}`);
      }

      console.log("Found incident:", {
        id: incident._id,
        type: incident.type,
        resolved: incident.resolved,
        resolvedAt: incident.resolvedAt,
      });

      // Check if already resolved - with better feedback
      if (incident.resolved) {
        const resolvedTime = incident.resolvedAt
          ? new Date(incident.resolvedAt).toLocaleString()
          : "previously";

        req.flash(
          "warning",
          `⚠️ Incident "${incident.type}" was already resolved ${resolvedTime} by ` +
            (incident.resolvedBy
              ? `user ${incident.resolvedBy}`
              : "an administrator")
        );
        return res.redirect(`/admin/deliveries/${id}`);
      }

      // Mark incident as resolved
      incident.resolved = true;
      incident.resolvedAt = new Date();
      incident.resolvedBy = req.user._id;

      // Add resolution notes to additionalDetails
      if (resolutionNotes && resolutionNotes.trim()) {
        if (!incident.additionalDetails) {
          incident.additionalDetails = {};
        }
        incident.additionalDetails.resolutionNotes = resolutionNotes.trim();
        incident.additionalDetails.resolvedBy = req.user._id;
        incident.additionalDetails.resolvedAt = new Date();
      }

      // Check if all incidents are now resolved
      const allResolved = delivery.incidents.every((inc) => inc.resolved);

      // If delivery was delayed due to this incident and all incidents are resolved,
      // update status back to in_transit (if not already delivered/cancelled)
      if (
        allResolved &&
        delivery.status === "delayed" &&
        delivery.status !== "delivered" &&
        delivery.status !== "cancelled"
      ) {
        // Check if there's an estimated delay that has passed
        const now = new Date();
        let shouldUpdateStatus = true;

        if (delivery.delayInfo && delivery.delayInfo.estimatedDelay) {
          // Calculate when the delay should end
          const delayEndTime = new Date(delivery.delayInfo.reportedAt);
          delayEndTime.setMinutes(
            delayEndTime.getMinutes() + delivery.delayInfo.estimatedDelay
          );

          // If delay hasn't passed yet, keep status as delayed
          if (now < delayEndTime) {
            shouldUpdateStatus = false;
          }
        }

        if (shouldUpdateStatus) {
          delivery.status = "in_transit";

          // Clear delay info
          delivery.delayInfo = null;

          // Add to history
          if (!delivery.history) delivery.history = [];
          delivery.history.push({
            action: "incident_resolved_delay_cleared",
            description: "All incidents resolved, returning to normal delivery",
            details: {
              resolvedIncidents: delivery.incidents.filter(
                (inc) => inc.resolved
              ).length,
              totalIncidents: delivery.incidents.length,
            },
            user: req.user._id,
            timestamp: new Date(),
          });
        }
      }

      // Add to history
      if (!delivery.history) delivery.history = [];
      delivery.history.push({
        action: "incident_resolved",
        description: `${incident.type} incident resolved`,
        details: {
          severity: incident.severity,
          resolutionNotes: resolutionNotes?.trim(),
          allIncidentsResolved: allResolved,
        },
        user: req.user._id,
        timestamp: new Date(),
      });

      delivery.updatedAt = new Date();
      delivery.updatedBy = req.user._id;

      await delivery.save();

      console.log("Incident successfully resolved:", {
        incidentId: incident._id,
        resolvedAt: incident.resolvedAt,
        resolvedBy: incident.resolvedBy,
      });

      req.flash(
        "success",
        `✅ Incident "${incident.type}" has been marked as resolved`
      );
      res.redirect(`/admin/deliveries/${delivery._id}#accident`);
    } catch (error) {
      console.error("Error resolving incident:", error);
      req.flash("error", `Error resolving incident: ${error.message}`);
      res.redirect(`/admin/deliveries/${req.params.id}`);
    }
  };

  // Delete delivery - Updated for warehouses
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

      // Remove delivery from driver assignments only
      if (delivery.driver) {
        await Driver.findByIdAndUpdate(delivery.driver, {
          $pull: { currentDeliveries: id },
        });
      }

      // Warehouses don't track deliveries, so no need to update

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

  // Warehouse Management (replaces Vehicle Management)
  getAllWarehouses = async (req, res) => {
    try {
      const warehouses = await Warehouse.find().sort({ name: 1 });

      // Format coordinates for display
      const warehousesWithFormattedCoords = warehouses.map((warehouse) => ({
        ...warehouse.toObject(),
        coordinatesString: warehouse.location.coordinates.join(", "),
      }));

      res.render("admin/warehouses", {
        title: "Warehouse Management",
        warehouses: warehousesWithFormattedCoords,
        admin: req.user,
      });
    } catch (error) {
      console.error("Error fetching warehouses:", error);
      req.flash("error", "Error loading warehouses");
      res.redirect("/admin");
    }
  };

  // Driver Management - Updated to remove vehicle references
  getAllDrivers = async (req, res) => {
    try {
      const drivers = await Driver.find().sort({ status: 1, name: 1 });

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
