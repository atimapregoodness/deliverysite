import mongoose from "mongoose";

const locationLogSchema = new mongoose.Schema(
  {
    delivery: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delivery",
      required: true,
      index: true,
    },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    address: String,
    speed: Number,
    batteryLevel: Number,
    signalStrength: Number,
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
locationLogSchema.index({ delivery: 1, timestamp: -1 });

export default mongoose.model("LocationLog", locationLogSchema);
