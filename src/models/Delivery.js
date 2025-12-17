const mongoose = require("mongoose");
const axios = require("axios"); // You'll need to install: npm install axios

const deliverySchema = new mongoose.Schema(
  {
    trackingId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    // Sender information with geocoding support
    sender: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: true },
      address: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String },
        country: { type: String, default: "United States" },
        postalCode: { type: String },
        // GeoJSON Point for Mapbox
        coordinates: {
          type: { type: String, enum: ["Point"], default: "Point" },
          coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
        },
        // Original address string for geocoding reference
        fullAddress: { type: String },
        // Geocoding metadata
        geocoded: { type: Boolean, default: false },
        geocodingError: { type: String },
        lastGeocodedAt: { type: Date },
      },
    },

    // Receiver information with geocoding support
    receiver: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: true },
      address: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String },
        country: { type: String, default: "United States" },
        postalCode: { type: String },
        // GeoJSON Point for Mapbox
        coordinates: {
          type: { type: String, enum: ["Point"], default: "Point" },
          coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
        },
        // Original address string for geocoding reference
        fullAddress: { type: String },
        // Geocoding metadata
        geocoded: { type: Boolean, default: false },
        geocodingError: { type: String },
        lastGeocodedAt: { type: Date },
      },
      deliveryInstructions: { type: String },
      signatureRequired: { type: Boolean, default: true },
    },

    // Update the package schema to include category
    package: {
      description: { type: String, required: true },
      category: {
        type: String,
        enum: [
          "electronics",
          "clothing",
          "furniture",
          "documents",
          "food",
          "medical",
          "other",
        ],
        default: "other",
      },
      weight: { type: Number, required: true }, // in kg
      dimensions: {
        length: { type: Number },
        width: { type: Number },
        height: { type: Number },
      },
      value: { type: Number, default: 0 },
    },

    status: {
      type: String,
      enum: ["pending", "in_transit", "delayed", "delivered", "cancelled"],
      default: "pending",
      index: true,
    },

    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      index: true,
    },

    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
    },

    estimatedDelivery: {
      type: Date,
      required: true,
      index: true,
    },

    actualDelivery: {
      type: Date,
    },

    // Enhanced tracking data for real-time Mapbox integration
    trackingData: {
      active: { type: Boolean, default: false },
      currentLocation: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
      },
      routeProgress: { type: Number, default: 0, min: 0, max: 100 },
      lastUpdated: { type: Date, default: Date.now },
      // For real-time updates
      speed: { type: Number, default: 0 }, // km/h
      bearing: { type: Number, default: 0 }, // degrees
      // For ETA calculation
      estimatedArrival: { type: Date },
      remainingDistance: { type: Number }, // meters
      // Mapbox-specific data
      mapboxRouteId: { type: String }, // Store Mapbox Directions API route ID
      waypoints: [
        {
          sequence: Number,
          coordinates: [Number], // [lng, lat]
          type: { type: String, enum: ["pickup", "delivery", "waypoint"] },
          name: String,
          arrived: { type: Boolean, default: false },
          timestamp: Date,
        },
      ],
    },

    // Mapbox route data
    route: {
      // Store the full Mapbox Directions API response
      mapboxDirections: { type: mongoose.Schema.Types.Mixed },
      totalDistance: { type: Number, default: 0 }, // meters
      totalDuration: { type: Number, default: 0 }, // seconds
      geometry: { type: String }, // Encoded polyline
      bounds: [[Number]], // [[minLng, minLat], [maxLng, maxLat]]
      legs: [
        {
          distance: Number, // meters
          duration: Number, // seconds
          steps: [mongoose.Schema.Types.Mixed], // Mapbox steps
        },
      ],
      optimized: { type: Boolean, default: false },
    },

    // Incidents/accidents with location
    incidents: [
      {
        type: {
          type: String,
          enum: ["accident", "breakdown", "traffic", "weather", "other"],
          required: true,
        },
        description: { type: String, required: true },
        location: {
          type: { type: String, enum: ["Point"], default: "Point" },
          coordinates: { type: [Number] }, // [lng, lat]
        },
        address: { type: String },
        severity: {
          type: String,
          enum: ["low", "medium", "high", "critical"],
          default: "medium",
        },
        reportedAt: { type: Date, default: Date.now },
        estimatedDelay: { type: Number, default: 0 }, // minutes
        emergencyServices: { type: Boolean, default: false },
        resolved: { type: Boolean, default: false },
        resolvedAt: { type: Date },
        // For Mapbox display
        mapboxMarkerId: { type: String },
      },
    ],

    // Enhanced delay info
    delayInfo: {
      reason: {
        type: String,
        enum: ["traffic", "weather", "vehicle", "driver", "recipient", "other"],
      },
      description: { type: String },
      estimatedDelay: { type: Number }, // minutes
      reportedAt: { type: Date },
      resolvedAt: { type: Date },
      location: {
        type: { type: String, enum: ["Point"] },
        coordinates: { type: [Number] },
      },
    },

    // Geocoding service configuration
    geocoding: {
      provider: {
        type: String,
        enum: ["mapbox", "google", "nominatim"],
        default: "mapbox",
      },
      mapboxSessionToken: { type: String }, // For Mapbox Geocoding API
      lastGeocodedAt: { type: Date },
      geocodingAttempts: { type: Number, default: 0 },
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================
deliverySchema.index({ trackingId: 1 });
deliverySchema.index({ status: 1 });
deliverySchema.index({ driver: 1 });
deliverySchema.index({ estimatedDelivery: 1 });
// Geospatial indexes for Mapbox queries
deliverySchema.index({ "sender.address.coordinates": "2dsphere" });
deliverySchema.index({ "receiver.address.coordinates": "2dsphere" });
deliverySchema.index({ "trackingData.currentLocation": "2dsphere" });
deliverySchema.index({ "incidents.location": "2dsphere" });
deliverySchema.index({ "delayInfo.location": "2dsphere" });
// Compound indexes for common queries
deliverySchema.index({ status: 1, estimatedDelivery: 1 });
deliverySchema.index({ driver: 1, status: 1 });
deliverySchema.index({ "sender.address.city": 1, status: 1 });
deliverySchema.index({ "receiver.address.city": 1, status: 1 });

// ============================================
// VIRTUAL PROPERTIES
// ============================================
deliverySchema.virtual("deliveryAddress").get(function () {
  const addr = this.receiver.address;
  return `${
    addr.street
  }, ${addr.city}${addr.state ? `, ${addr.state}` : ""}${addr.postalCode ? ` ${addr.postalCode}` : ""}`;
});

deliverySchema.virtual("pickupAddress").get(function () {
  const addr = this.sender.address;
  return `${
    addr.street
  }, ${addr.city}${addr.state ? `, ${addr.state}` : ""}${addr.postalCode ? ` ${addr.postalCode}` : ""}`;
});

deliverySchema.virtual("isOverdue").get(function () {
  return (
    this.estimatedDelivery < new Date() &&
    !["delivered", "cancelled"].includes(this.status)
  );
});

deliverySchema.virtual("currentLocationLatLng").get(function () {
  const coords = this.trackingData.currentLocation.coordinates;
  return coords && coords.length === 2
    ? { lat: coords[1], lng: coords[0] }
    : null;
});

// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================
deliverySchema.pre("save", async function (next) {
  try {
    // Auto-generate tracking ID if not provided
    if (!this.trackingId) {
      this.trackingId = this.constructor.generateTrackingId();
    }

    // Build full address strings for geocoding
    if (this.sender.address && !this.sender.address.fullAddress) {
      this.sender.address.fullAddress = this.pickupAddress;
    }

    if (this.receiver.address && !this.receiver.address.fullAddress) {
      this.receiver.address.fullAddress = this.deliveryAddress;
    }

    // Initialize current location to sender's location if not set
    if (
      this.isNew &&
      this.sender.address.coordinates.coordinates[0] !== 0 &&
      this.sender.address.coordinates.coordinates[1] !== 0 &&
      (!this.trackingData.currentLocation.coordinates ||
        this.trackingData.currentLocation.coordinates[0] === 0)
    ) {
      this.trackingData.currentLocation.coordinates = [
        ...this.sender.address.coordinates.coordinates,
      ];
    }

    next();
  } catch (error) {
    next(error);
  }
});

// ============================================
// INSTANCE METHODS
// ============================================

// Update vehicle position with Mapbox integration
deliverySchema.methods.updatePosition = async function (
  longitude,
  latitude,
  progress = null,
  speed = 0,
  bearing = 0
) {
  this.trackingData.currentLocation.coordinates = [longitude, latitude];
  this.trackingData.lastUpdated = new Date();

  if (progress !== null) {
    this.trackingData.routeProgress = Math.min(100, Math.max(0, progress));
  }

  if (speed !== undefined) {
    this.trackingData.speed = speed;
  }

  if (bearing !== undefined) {
    this.trackingData.bearing = bearing;
  }

  return this.save();
};

// Geocode an address using Mapbox
deliverySchema.methods.geocodeAddress = async function (
  addressString,
  addressType = "sender" // "sender" or "receiver"
) {
  try {
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) {
      throw new Error("MAPBOX_ACCESS_TOKEN environment variable is not set");
    }

    const encodedAddress = encodeURIComponent(addressString);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1`;

    const response = await axios.get(url);
    const features = response.data.features;

    if (features && features.length > 0) {
      const [longitude, latitude] = features[0].center;
      const placeName = features[0].place_name;

      // Update the specified address
      if (addressType === "sender") {
        this.sender.address.coordinates.coordinates = [longitude, latitude];
        this.sender.address.geocoded = true;
        this.sender.address.lastGeocodedAt = new Date();
        this.sender.address.geocodingError = null;
      } else if (addressType === "receiver") {
        this.receiver.address.coordinates.coordinates = [longitude, latitude];
        this.receiver.address.geocoded = true;
        this.receiver.address.lastGeocodedAt = new Date();
        this.receiver.address.geocodingError = null;
      }

      await this.save();

      return {
        success: true,
        coordinates: [longitude, latitude],
        placeName: placeName,
        addressType: addressType,
      };
    } else {
      throw new Error("Address not found");
    }
  } catch (error) {
    // Record error
    if (addressType === "sender") {
      this.sender.address.geocodingError = error.message;
    } else {
      this.receiver.address.geocodingError = error.message;
    }

    await this.save();

    return {
      success: false,
      error: error.message,
      addressType: addressType,
    };
  }
};

// Geocode both addresses
deliverySchema.methods.geocodeBothAddresses = async function () {
  const results = [];

  if (this.sender.address.fullAddress) {
    const senderResult = await this.geocodeAddress(
      this.sender.address.fullAddress,
      "sender"
    );
    results.push(senderResult);
  }

  if (this.receiver.address.fullAddress) {
    const receiverResult = await this.geocodeAddress(
      this.receiver.address.fullAddress,
      "receiver"
    );
    results.push(receiverResult);
  }

  return results;
};

// Get Mapbox directions between sender and receiver
deliverySchema.methods.getMapboxDirections = async function (
  profile = "driving" // driving, walking, cycling
) {
  try {
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) {
      throw new Error("MAPBOX_ACCESS_TOKEN environment variable is not set");
    }

    const startCoords = this.sender.address.coordinates.coordinates;
    const endCoords = this.receiver.address.coordinates.coordinates;

    // Ensure coordinates are valid
    if (startCoords[0] === 0 && startCoords[1] === 0) {
      throw new Error(
        "Sender coordinates not set. Geocode sender address first."
      );
    }

    if (endCoords[0] === 0 && endCoords[1] === 0) {
      throw new Error(
        "Receiver coordinates not set. Geocode receiver address first."
      );
    }

    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${startCoords[0]},${startCoords[1]};${endCoords[0]},${endCoords[1]}?access_token=${mapboxToken}&geometries=geojson&steps=true&overview=full`;

    const response = await axios.get(url);
    const route = response.data.routes[0];

    // Store route data
    this.route = {
      mapboxDirections: response.data,
      totalDistance: route.distance,
      totalDuration: route.duration,
      geometry: route.geometry,
      bounds: this.calculateBounds(route.geometry),
      legs: route.legs,
      optimized: false,
    };

    // Initialize waypoints for tracking
    this.trackingData.waypoints = [
      {
        sequence: 0,
        coordinates: startCoords,
        type: "pickup",
        name: "Pickup Location",
        arrived: true,
        timestamp: new Date(),
      },
      {
        sequence: 1,
        coordinates: endCoords,
        type: "delivery",
        name: "Delivery Location",
        arrived: false,
      },
    ];

    this.trackingData.mapboxRouteId = response.data.uuid;

    await this.save();

    return {
      success: true,
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// Add incident with automatic geocoding
deliverySchema.methods.addIncident = async function (incidentData) {
  const incident = {
    ...incidentData,
    reportedAt: new Date(),
    resolved: false,
  };

  // If location is provided as address string, geocode it
  if (incidentData.address && !incidentData.location) {
    try {
      const geocodeResult = await this.geocodeAddress(
        incidentData.address,
        "incident"
      );
      if (geocodeResult.success) {
        incident.location = {
          type: "Point",
          coordinates: geocodeResult.coordinates,
        };
      }
    } catch (error) {
      console.error("Failed to geocode incident location:", error);
    }
  }

  if (!this.incidents) {
    this.incidents = [];
  }

  this.incidents.push(incident);

  // Update status to delayed if incident reported
  if (!this.actualDelivery && this.status !== "cancelled") {
    this.status = "delayed";

    // Set delay info
    this.delayInfo = {
      reason: incidentData.type || "incident",
      description: incidentData.description || "Incident reported",
      estimatedDelay: incidentData.estimatedDelay || 30,
      reportedAt: new Date(),
      location: incident.location,
    };
  }

  return this.save();
};

// Mark as delivered
deliverySchema.methods.markAsDelivered = function (proof = {}) {
  this.status = "delivered";
  this.actualDelivery = new Date();
  this.trackingData.active = false;
  this.trackingData.routeProgress = 100;

  // Mark all incidents as resolved
  if (this.incidents && this.incidents.length > 0) {
    this.incidents.forEach((incident) => {
      if (!incident.resolved) {
        incident.resolved = true;
        incident.resolvedAt = new Date();
      }
    });
  }

  // Clear delay info
  if (this.delayInfo) {
    this.delayInfo.resolvedAt = new Date();
  }

  return this.save();
};

// Calculate route bounds for Mapbox viewport
deliverySchema.methods.calculateBounds = function (geometry) {
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

// Get data for Mapbox rendering
deliverySchema.methods.getMapboxData = function () {
  return {
    deliveryId: this._id,
    trackingId: this.trackingId,
    status: this.status,

    // Points for markers
    points: {
      pickup: {
        coordinates: this.sender.address.coordinates.coordinates,
        address: this.pickupAddress,
        name: this.sender.name,
      },
      delivery: {
        coordinates: this.receiver.address.coordinates.coordinates,
        address: this.deliveryAddress,
        name: this.receiver.name,
      },
      current: {
        coordinates: this.trackingData.currentLocation.coordinates,
        progress: this.trackingData.routeProgress,
        bearing: this.trackingData.bearing,
        speed: this.trackingData.speed,
      },
    },

    // Route data
    route: this.route
      ? {
          geometry: this.route.geometry,
          bounds: this.route.bounds,
          distance: this.route.totalDistance,
          duration: this.route.totalDuration,
        }
      : null,

    // Incidents
    incidents: this.incidents
      ? this.incidents.map((incident) => ({
          type: incident.type,
          description: incident.description,
          coordinates: incident.location ? incident.location.coordinates : null,
          severity: incident.severity,
          resolved: incident.resolved,
        }))
      : [],

    // Tracking metadata
    tracking: {
      active: this.trackingData.active,
      lastUpdated: this.trackingData.lastUpdated,
      estimatedArrival: this.trackingData.estimatedArrival,
      waypoints: this.trackingData.waypoints || [],
    },
  };
};

// ============================================
// STATIC METHODS
// ============================================

// Generate tracking ID
deliverySchema.statics.generateTrackingId = function () {
  const prefix = "DEL";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

// Find deliveries by status with geospatial filtering
deliverySchema.statics.findByStatus = function (status, options = {}) {
  const query = this.find({ status })
    .populate("driver", "name phone currentLocation")
    .populate("vehicle", "plateNumber model currentLocation");

  // Add geospatial filter if provided
  if (options.near && options.maxDistance) {
    query.where("trackingData.currentLocation").near({
      center: options.near,
      maxDistance: options.maxDistance, // in meters
      spherical: true,
    });
  }

  return query;
};

// Find deliveries near a location (for Mapbox clustering)
deliverySchema.statics.findNearLocation = function (
  coordinates, // [lng, lat]
  maxDistance = 5000, // meters
  status = null
) {
  const query = {
    "trackingData.currentLocation": {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: coordinates,
        },
        $maxDistance: maxDistance,
      },
    },
  };

  if (status) {
    query.status = status;
  }

  return this.find(query)
    .populate("driver", "name phone")
    .populate("vehicle", "plateNumber model");
};

// Batch geocode deliveries with missing coordinates
deliverySchema.statics.batchGeocode = async function (limit = 10) {
  const deliveries = await this.find({
    $or: [
      { "sender.address.coordinates.coordinates": [0, 0] },
      { "receiver.address.coordinates.coordinates": [0, 0] },
      { "sender.address.geocoded": false },
      { "receiver.address.geocoded": false },
    ],
  }).limit(limit);

  const results = [];

  for (const delivery of deliveries) {
    try {
      const geocodeResults = await delivery.geocodeBothAddresses();
      results.push({
        deliveryId: delivery._id,
        trackingId: delivery.trackingId,
        geocodeResults,
      });
    } catch (error) {
      results.push({
        deliveryId: delivery._id,
        trackingId: delivery.trackingId,
        error: error.message,
      });
    }
  }

  return results;
};

// ============================================
// POST-SAVE HOOK
// ============================================
deliverySchema.post("save", function (doc) {
  // Emit WebSocket event for real-time updates
  if (global.io && this.trackingData.active) {
    const mapboxData = doc.getMapboxData();
    global.io
      .to(`delivery_${doc.trackingId}`)
      .emit("delivery_updated", mapboxData);
  }
});

module.exports = mongoose.model("Delivery", deliverySchema);
