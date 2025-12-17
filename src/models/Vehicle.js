// models/Vehicle.js
const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    plateNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    model: { type: String, required: true },
    make: { type: String, required: true },
    year: { type: Number },
    color: { type: String },
    type: {
      type: String,
      enum: ["van", "truck", "car", "motorcycle", "bicycle"],
      default: "van",
    },

    currentLocation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
      lastUpdated: { type: Date, default: Date.now },
    },

    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
    },

    status: {
      type: String,
      enum: ["active", "maintenance", "idle", "in_use"],
      default: "active",
    },

    capacity: {
      weight: { type: Number }, // kg
      volume: { type: Number }, // cubic meters
    },

    telemetry: {
      speed: { type: Number, default: 0 },
      fuelLevel: { type: Number, default: 100 },
      mileage: { type: Number, default: 0 },
      lastMaintenance: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

// Geospatial index
vehicleSchema.index({ currentLocation: "2dsphere" });

module.exports = mongoose.model("Vehicle", vehicleSchema);
