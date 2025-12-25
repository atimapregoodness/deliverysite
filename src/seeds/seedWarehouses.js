const mongoose = require("mongoose");
require("dotenv").config();

const Warehouse = require("../models/Warehouse");

const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/express_delivery",
      { useNewUrlParser: true, useUnifiedTopology: true }
    );
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

const warehouses = [
  {
    name: "New York Main Distribution Center",
    code: "NYC001",
    location: {
      type: "Point",
      coordinates: [-73.9851, 40.7589],
    },
    address: {
      street: "123 Broadway",
      city: "New York",
      state: "NY",
      country: "United States",
      postalCode: "10001",
    },
    type: "distribution",
    capacity: {
      totalArea: 5000,
      storageUnits: 200,
      maxWeight: 1000,
    },
    status: "active",
  },
  {
    name: "London Central Warehouse",
    code: "LON001",
    location: {
      type: "Point",
      coordinates: [-0.1278, 51.5074],
    },
    address: {
      street: "456 Fleet Street",
      city: "London",
      country: "United Kingdom",
      postalCode: "EC4A 2AA",
    },
    type: "storage",
    capacity: {
      totalArea: 3500,
      storageUnits: 150,
      maxWeight: 800,
    },
    status: "active",
  },
  {
    name: "Berlin Logistics Hub",
    code: "BER001",
    location: {
      type: "Point",
      coordinates: [13.405, 52.52],
    },
    address: {
      street: "789 Friedrichstraße",
      city: "Berlin",
      country: "Germany",
      postalCode: "10117",
    },
    type: "fulfillment",
    capacity: {
      totalArea: 4200,
      storageUnits: 180,
      maxWeight: 900,
    },
    status: "active",
  },
  {
    name: "Tokyo Distribution Center",
    code: "TYO001",
    location: {
      type: "Point",
      coordinates: [139.6503, 35.6762],
    },
    address: {
      street: "101 Ginza Street",
      city: "Tokyo",
      country: "Japan",
      postalCode: "104-0061",
    },
    type: "distribution",
    capacity: {
      totalArea: 2800,
      storageUnits: 120,
      maxWeight: 750,
    },
    status: "active",
  },
];

const seedWarehouses = async () => {
  try {
    await connectDB();

    console.log("Dropping warehouse collection...");
    try {
      await mongoose.connection.db.dropCollection("warehouses");
      console.log("✅ Collection dropped successfully");
    } catch (error) {
      if (error.codeName === "NamespaceNotFound") {
        console.log("⚠️  Collection doesn't exist, creating new one...");
      } else {
        throw error;
      }
    }

    let createdCount = 0;

    // Now create warehouses
    for (const warehouseData of warehouses) {
      const warehouse = new Warehouse(warehouseData);
      await warehouse.save();
      console.log(
        `✅ Created warehouse: ${warehouseData.name} (${warehouseData.code})`
      );
      createdCount++;
    }

    console.log("\n🎉 Warehouse seed completed!");
    console.log(`📊 Created: ${createdCount} warehouses`);

    // Display summary by type
    console.log("\n📋 Warehouse Type Summary:");
    const warehouseTypes = await Warehouse.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    warehouseTypes.forEach((type) => {
      console.log(`   ${type._id}: ${type.count}`);
    });
  } catch (error) {
    console.error("❌ Error seeding warehouses:", error.message);
    console.error(error.stack);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("\n🔌 Database connection closed");
    }
  }
};

if (require.main === module) seedWarehouses();
module.exports = seedWarehouses;
