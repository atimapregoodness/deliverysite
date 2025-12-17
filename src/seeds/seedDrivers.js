const mongoose = require("mongoose");
require("dotenv").config();

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

const drivers = [
  {
    name: "Michael Rodriguez",
    email: "michael.rodriguez@expressdelivery.com",
    phone: "+1-555-1001",
    licenseNumber: "DL123456789",
    currentLocation: {
      type: "Point",
      coordinates: [-73.9851, 40.7589],
      lastUpdated: new Date(),
    },
    status: "available",
    stats: {
      totalDeliveries: 156,
      ratingCount: 1,
    },
  },
  {
    name: "Sarah Johnson",
    email: "sarah.johnson@expressdelivery.com",
    phone: "+1-555-1002",
    licenseNumber: "DL987654321",
    currentLocation: {
      type: "Point",
      coordinates: [-73.9934, 40.7505],
      lastUpdated: new Date(),
    },
    status: "available",
    stats: {
      totalDeliveries: 89,
      ratingCount: 1,
    },
  },
  {
    name: "James Wilson",
    email: "james.wilson@expressdelivery.com",
    phone: "+1-555-1003",
    licenseNumber: "DL456789123",
    currentLocation: {
      type: "Point",
      coordinates: [-73.9942, 40.7282],
      lastUpdated: new Date(),
    },
    status: "break",
    stats: {
      totalDeliveries: 203,
      ratingCount: 1,
    },
  },
  {
    name: "Emily Chen",
    email: "emily.chen@expressdelivery.com",
    phone: "+1-555-1004",
    licenseNumber: "DL321654987",
    currentLocation: {
      type: "Point",
      coordinates: [-73.9776, 40.7614],
      lastUpdated: new Date(),
    },
    status: "available",
    stats: {
      totalDeliveries: 67,
      ratingCount: 1,
    },
  },
  {
    name: "David Kim",
    email: "david.kim@expressdelivery.com",
    phone: "+1-555-1005",
    licenseNumber: "DL789123456",
    currentLocation: {
      type: "Point",
      coordinates: [-73.982, 40.762],
      lastUpdated: new Date(),
    },
    status: "available",
    stats: {
      totalDeliveries: 134,
      ratingCount: 1,
    },
  },
];

const seedDrivers = async () => {
  try {
    await connectDB();

    let createdCount = 0;
    let skippedCount = 0;

    for (const driverData of drivers) {
      const existingDriver = await Driver.findOne({
        $or: [
          { email: driverData.email },
          { licenseNumber: driverData.licenseNumber },
        ],
      });

      if (existingDriver) {
        console.log(`Driver ${driverData.email} already exists, skipping...`);
        skippedCount++;
        continue;
      }

      const driver = new Driver(driverData);
      await driver.save();
      console.log(`✅ Created driver: ${driverData.name}`);
      createdCount++;
    }

    console.log("\n🎉 Driver seed completed!");
    console.log(`📊 Created: ${createdCount} drivers`);
    console.log(`⏭️  Skipped: ${skippedCount} existing drivers`);
  } catch (error) {
    console.error("❌ Error seeding drivers:", error);
  } finally {
    mongoose.connection.close();
  }
};

if (require.main === module) {
  seedDrivers();
}

module.exports = seedDrivers;
