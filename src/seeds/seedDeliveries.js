const mongoose = require("mongoose");
require("dotenv").config();

const Delivery = require("../models/Delivery");
const Driver = require("../models/Driver");
const Vehicle = require("../models/Vehicle");

const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/express_delivery",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

const deliveries = [
  {
    trackingId: "DEL82917463",
    sender: {
      name: "John Smith",
      phone: "+1-555-2001",
      email: "john.smith@email.com",
      address: {
        street: "123 Main Street",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "United States",
        coordinates: { type: "Point", coordinates: [-73.9934, 40.7505] },
        fullAddress: "123 Main Street, New York, NY 10001",
      },
    },
    receiver: {
      name: "Sarah Johnson",
      phone: "+1-555-3001",
      email: "sarah.johnson@email.com",
      address: {
        street: "456 Broadway",
        city: "New York",
        state: "NY",
        postalCode: "10012",
        country: "United States",
        coordinates: { type: "Point", coordinates: [-73.9942, 40.7282] },
        fullAddress: "456 Broadway, New York, NY 10012",
      },
      deliveryInstructions: "Ring bell twice",
      signatureRequired: true,
    },
    package: {
      description: "Electronics Package - Laptop and Accessories",
      weight: 2.5,
      dimensions: { length: 30, width: 20, height: 15 },
      value: 1200,
    },
    status: "in_transit",
    estimatedDelivery: new Date(Date.now() + 2 * 60 * 60 * 1000),
    trackingData: {
      active: true,
      currentLocation: { type: "Point", coordinates: [-73.9851, 40.7589] },
      routeProgress: 60,
      speed: 32,
      bearing: 45,
      lastUpdated: new Date(),
      estimatedArrival: new Date(Date.now() + 45 * 60 * 1000),
      waypoints: [
        {
          sequence: 0,
          coordinates: [-73.9934, 40.7505],
          type: "pickup",
          name: "Pickup Location",
          arrived: true,
          timestamp: new Date(),
        },
        {
          sequence: 1,
          coordinates: [-73.9942, 40.7282],
          type: "delivery",
          name: "Delivery Location",
          arrived: false,
        },
      ],
    },
  },
  {
    trackingId: "DEL73529184",
    sender: {
      name: "Maria Garcia",
      phone: "+1-555-2002",
      email: "maria.garcia@email.com",
      address: {
        street: "789 Park Avenue",
        city: "New York",
        state: "NY",
        postalCode: "10021",
        country: "United States",
        coordinates: { type: "Point", coordinates: [-73.9654, 40.7685] },
        fullAddress: "789 Park Avenue, New York, NY 10021",
      },
    },
    receiver: {
      name: "David Chen",
      phone: "+1-555-3002",
      email: "david.chen@email.com",
      address: {
        street: "321 5th Avenue",
        city: "New York",
        state: "NY",
        postalCode: "10016",
        country: "United States",
        coordinates: { type: "Point", coordinates: [-73.984, 40.745] },
        fullAddress: "321 5th Avenue, New York, NY 10016",
      },
      signatureRequired: false,
    },
    package: {
      description: "Clothing Order - Summer Collection",
      weight: 1.2,
      dimensions: { length: 40, width: 30, height: 10 },
      value: 150,
    },
    status: "out_for_delivery",
    estimatedDelivery: new Date(Date.now() + 3 * 60 * 60 * 1000),
    trackingData: {
      active: true,
      currentLocation: { type: "Point", coordinates: [-73.99, 40.74] },
      routeProgress: 30,
      speed: 25,
      bearing: 120,
      lastUpdated: new Date(),
      estimatedArrival: new Date(Date.now() + 90 * 60 * 1000),
    },
  },
];

const seedDeliveries = async () => {
  try {
    await connectDB();

    const drivers = await Driver.find({ status: "active" }).limit(3);
    const vehicles = await Vehicle.find({ status: "available" }).limit(3);

    for (let i = 0; i < deliveries.length; i++) {
      const data = deliveries[i];
      const existing = await Delivery.findOne({ trackingId: data.trackingId });
      if (existing) continue;

      if (drivers[i % drivers.length])
        data.driver = drivers[i % drivers.length]._id;
      if (vehicles[i % vehicles.length])
        data.vehicle = vehicles[i % vehicles.length]._id;

      const delivery = new Delivery(data);
      await delivery.save();
      console.log(`Created delivery: ${delivery.trackingId}`);
    }

    console.log("Seed completed successfully!");
  } catch (error) {
    console.error("Error seeding deliveries:", error);
  } finally {
    await mongoose.connection.close();
  }
};

if (require.main === module) seedDeliveries();
module.exports = seedDeliveries;
