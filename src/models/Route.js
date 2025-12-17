const mongoose = require("mongoose");

const routeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    delivery: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delivery",
      required: true,
    },
    waypoints: [
      {
        sequence: { type: Number, required: true },
        location: {
          lat: { type: Number, required: true },
          lng: { type: Number, required: true },
        },
        address: { type: String, required: true },
        type: {
          type: String,
          enum: ["pickup", "delivery", "checkpoint"],
          required: true,
        },
        estimatedArrival: { type: Date },
        actualArrival: { type: Date },
        status: {
          type: String,
          enum: ["pending", "arrived", "departed", "skipped"],
          default: "pending",
        },
      },
    ],
    optimizedRoute: {
      geometry: {
        type: { type: String, default: "LineString" },
        coordinates: { type: [[Number]], default: [] }, // [lng, lat]
      },
      distance: { type: Number, default: 0 }, // in meters
      duration: { type: Number, default: 0 }, // in seconds
      instructions: [
        {
          step: { type: Number },
          instruction: { type: String },
          distance: { type: Number },
          duration: { type: Number },
        },
      ],
    },
    trafficConditions: {
      congestion: {
        type: String,
        enum: ["low", "moderate", "heavy", "severe"],
      },
      delay: { type: Number, default: 0 }, // in seconds
    },
    weatherConditions: {
      condition: { type: String },
      temperature: { type: Number },
      visibility: { type: Number },
    },
    efficiency: {
      score: { type: Number, min: 0, max: 100, default: 0 },
      fuelEstimate: { type: Number, default: 0 }, // in liters
      co2Savings: { type: Number, default: 0 }, // in kg
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

// Index for geospatial queries
routeSchema.index({ "optimizedRoute.geometry": "2dsphere" });
routeSchema.index({ delivery: 1 });

// Method to calculate route efficiency
routeSchema.methods.calculateEfficiency = function () {
  if (!this.optimizedRoute.distance || !this.optimizedRoute.duration) {
    return 0;
  }

  const distanceKm = this.optimizedRoute.distance / 1000;
  const durationHours = this.optimizedRoute.duration / 3600;

  // Simple efficiency calculation based on distance and time
  const baseEfficiency = 80; // Base efficiency score
  const distanceFactor = Math.min(distanceKm / 50, 1); // Normalize by 50km
  const timeFactor = Math.min(durationHours / 2, 1); // Normalize by 2 hours

  return Math.round(baseEfficiency * distanceFactor * timeFactor);
};

// Method to update waypoint status
routeSchema.methods.updateWaypoint = function (
  sequence,
  status,
  actualArrival = null
) {
  const waypoint = this.waypoints.find((wp) => wp.sequence === sequence);
  if (waypoint) {
    waypoint.status = status;
    if (actualArrival) {
      waypoint.actualArrival = actualArrival;
    }
  }
  return this.save();
};

// Static method to find active routes
routeSchema.statics.findActive = function () {
  return this.find({
    isActive: true,
    completedAt: { $exists: false },
  }).populate("delivery");
};

module.exports = mongoose.model("Route", routeSchema);
