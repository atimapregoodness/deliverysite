const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const driverSchema = new Schema(
  {
    name: { 
      type: String, 
      required: [true, "Driver name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"]
    },
    phone: { 
      type: String, 
      required: [true, "Phone number is required"],

    },
    email: { 
      type: String, 
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"]
    },
    licenseNumber: { 
      type: String, 
      unique: true,
      uppercase: true,
      trim: true
    },
    photo: { 
      type: String,
      default: null
    },
    rating: { 
      type: Number, 
      default: 4.5, 
      min: [0, "Rating cannot be less than 0"], 
      max: [5, "Rating cannot exceed 5"] 
    },

    currentLocation: {
      type: { 
        type: String, 
        enum: ["Point"], 
        default: "Point" 
      },
      coordinates: { 
        type: [Number], 
        default: [0, 0],
        validate: {
          validator: function(coords) {
            return coords.length === 2;
          },
          message: "Coordinates must be [longitude, latitude]"
        }
      },
      lastUpdated: { 
        type: Date, 
        default: Date.now 
      },
    },


    currentDeliveries: [{
      type: Schema.Types.ObjectId,
      ref: "Delivery",
    }],

    status: {
      type: String,
      enum: {
        values: ["available", "on_delivery", "off_duty", "break"],
        message: "{VALUE} is not a valid driver status"
      },
      default: "available",
    },

    stats: {
      totalDeliveries: { 
        type: Number, 
        default: 0,
        min: 0 
      },
      onTimeDeliveries: { 
        type: Number, 
        default: 0,
        min: 0 
      },
      totalDistance: { 
        type: Number, 
        default: 0,
        min: 0 
      },
      ratingCount: { 
        type: Number, 
        default: 0,
        min: 0 
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Geospatial index - REMOVE DUPLICATE IF USING index: true above
driverSchema.index({ currentLocation: "2dsphere" });

// Compound indexes for common queries
driverSchema.index({ status: 1, rating: -1 });
driverSchema.index({ licenseNumber: 1 }, { unique: true });
driverSchema.index({ email: 1 }, { unique: true });

// Virtual for on-time percentage
driverSchema.virtual('onTimePercentage').get(function() {
  if (this.stats.totalDeliveries === 0) return 0;
  return (this.stats.onTimeDeliveries / this.stats.totalDeliveries) * 100;
});

module.exports = mongoose.model("Driver", driverSchema);