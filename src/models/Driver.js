// models/Driver.js
const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    licenseNumber: { type: String, required: true, unique: true },
    photo: { type: String },
    rating: { type: Number, default: 4.5, min: 0, max: 5 },

    currentLocation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
      lastUpdated: { type: Date, default: Date.now },
    },

    assignedVehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
    },

    currentDeliveries: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Delivery",
      },
    ],

    status: {
      type: String,
      enum: ["available", "on_delivery", "off_duty", "break"],
      default: "available",
    },

    stats: {
      totalDeliveries: { type: Number, default: 0 },
      onTimeDeliveries: { type: Number, default: 0 },
      totalDistance: { type: Number, default: 0 }, // km
      ratingCount: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Geospatial index
driverSchema.index({ currentLocation: "2dsphere" });

module.exports = mongoose.model("Driver", driverSchema);
