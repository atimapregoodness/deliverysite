const mongoose = require("mongoose");
require("dotenv").config();

const Delivery = require("../models/Delivery");
const Driver = require("../models/Driver");
const Warehouse = require("../models/Warehouse"); // Changed from Vehicle to Warehouse

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

// First, let's create some warehouses
const warehousesData = [
  {
    name: "Main Distribution Center",
    code: "WHS001",
    location: {
      type: "Point",
      coordinates: [-73.9857, 40.7489], // New York coordinates
    },
  },
  {
    name: "Downtown Warehouse",
    code: "WHS002",
    location: {
      type: "Point",
      coordinates: [-74.006, 40.7128], // Manhattan coordinates
    },
  },
  {
    name: "Brooklyn Storage",
    code: "WHS003",
    location: {
      type: "Point",
      coordinates: [-73.9442, 40.6782], // Brooklyn coordinates
    },
  },
];

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
      category: "electronics",
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
      category: "clothing",
    },
    status: "in_transit",
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
  {
    trackingId: "DEL91827364",
    sender: {
      name: "Tech Solutions Inc",
      phone: "+1-555-2003",
      email: "sales@techsolutions.com",
      address: {
        street: "500 Tech Park",
        city: "Brooklyn",
        state: "NY",
        postalCode: "11201",
        country: "United States",
        coordinates: { type: "Point", coordinates: [-73.9876, 40.6943] },
        fullAddress: "500 Tech Park, Brooklyn, NY 11201",
      },
    },
    receiver: {
      name: "Robert Williams",
      phone: "+1-555-3003",
      email: "robert.williams@email.com",
      address: {
        street: "222 Queens Blvd",
        city: "Queens",
        state: "NY",
        postalCode: "11355",
        country: "United States",
        coordinates: { type: "Point", coordinates: [-73.8554, 40.742] },
        fullAddress: "222 Queens Blvd, Queens, NY 11355",
      },
      deliveryInstructions: "Leave with receptionist",
      signatureRequired: true,
    },
    package: {
      description: "Office Supplies - Printer Cartridges",
      weight: 5.0,
      dimensions: { length: 35, width: 25, height: 20 },
      value: 300,
      category: "office",
    },
    status: "pending",
    estimatedDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000),
  },
  {
    trackingId: "DEL64738291",
    sender: {
      name: "Bookstore Cafe",
      phone: "+1-555-2004",
      email: "orders@bookstorecafe.com",
      address: {
        street: "150 Literary Lane",
        city: "Manhattan",
        state: "NY",
        postalCode: "10010",
        country: "United States",
        coordinates: { type: "Point", coordinates: [-73.9897, 40.7389] },
        fullAddress: "150 Literary Lane, Manhattan, NY 10010",
      },
    },
    receiver: {
      name: "Lisa Anderson",
      phone: "+1-555-3004",
      email: "lisa.anderson@email.com",
      address: {
        street: "90 Riverside Drive",
        city: "New York",
        state: "NY",
        postalCode: "10024",
        country: "United States",
        coordinates: { type: "Point", coordinates: [-73.9814, 40.7889] },
        fullAddress: "90 Riverside Drive, New York, NY 10024",
      },
      deliveryInstructions: "Call upon arrival",
      signatureRequired: false,
    },
    package: {
      description: "Books - Fiction Collection",
      weight: 3.5,
      dimensions: { length: 25, width: 18, height: 12 },
      value: 85,
      category: "books",
    },
    status: "delivered",
    estimatedDelivery: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    actualDelivery: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    trackingData: {
      active: false,
      currentLocation: { type: "Point", coordinates: [-73.9814, 40.7889] },
      routeProgress: 100,
      speed: 0,
      bearing: 0,
      lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  },
  {
    trackingId: "DEL19283746",
    sender: {
      name: "Pharmacy Express",
      phone: "+1-555-2005",
      email: "orders@pharmacyexpress.com",
      address: {
        street: "300 Health Street",
        city: "Bronx",
        state: "NY",
        postalCode: "10451",
        country: "United States",
        coordinates: { type: "Point", coordinates: [-73.9258, 40.8224] },
        fullAddress: "300 Health Street, Bronx, NY 10451",
      },
    },
    receiver: {
      name: "Michael Brown",
      phone: "+1-555-3005",
      email: "michael.brown@email.com",
      address: {
        street: "45 Medical Plaza",
        city: "Staten Island",
        state: "NY",
        postalCode: "10301",
        country: "United States",
        coordinates: { type: "Point", coordinates: [-74.0751, 40.6423] },
        fullAddress: "45 Medical Plaza, Staten Island, NY 10301",
      },
      deliveryInstructions: "URGENT - Medical supplies",
      signatureRequired: true,
    },
    package: {
      description: "Medical Equipment - Portable Oxygen Concentrator",
      weight: 8.2,
      dimensions: { length: 50, width: 30, height: 25 },
      value: 2500,
      category: "medical",
    },
    status: "delayed",
    estimatedDelivery: new Date(Date.now() + 4 * 60 * 60 * 1000),
    delayInfo: {
      reason: "Traffic congestion",
      description: "Major accident on highway causing delays",
      estimatedDelay: 120, // minutes
      reportedAt: new Date(Date.now() - 60 * 60 * 1000),
    },
    trackingData: {
      active: true,
      currentLocation: { type: "Point", coordinates: [-74.0429, 40.5835] },
      routeProgress: 45,
      speed: 10,
      bearing: 180,
      lastUpdated: new Date(),
    },
  },
];

const seedDeliveries = async () => {
  try {
    await connectDB();

    // Clear existing data
    console.log("Clearing existing data...");
    await Delivery.deleteMany({});
    await Warehouse.deleteMany({});

    // Create warehouses first
    console.log("Creating warehouses...");
    const createdWarehouses = [];
    for (const warehouseData of warehousesData) {
      const existingWarehouse = await Warehouse.findOne({
        code: warehouseData.code,
      });
      if (!existingWarehouse) {
        const warehouse = new Warehouse(warehouseData);
        await warehouse.save();
        createdWarehouses.push(warehouse);
        console.log(`Created warehouse: ${warehouse.name} (${warehouse.code})`);
      } else {
        createdWarehouses.push(existingWarehouse);
      }
    }

    // Get active drivers
    const drivers = await Driver.find({ status: "active" }).limit(5);
    console.log(`Found ${drivers.length} active drivers`);

    // Create deliveries with warehouse assignments
    console.log("Creating deliveries...");
    for (let i = 0; i < deliveries.length; i++) {
      const deliveryData = deliveries[i];
      const existing = await Delivery.findOne({
        trackingId: deliveryData.trackingId,
      });
      if (existing) {
        console.log(`Delivery already exists: ${deliveryData.trackingId}`);
        continue;
      }

      // Assign a driver if available
      if (drivers[i % drivers.length]) {
        deliveryData.driver = drivers[i % drivers.length]._id;
      }

      // Assign a warehouse
      if (createdWarehouses[i % createdWarehouses.length]) {
        deliveryData.warehouse =
          createdWarehouses[i % createdWarehouses.length]._id;

        // Set starting location to warehouse location for pending and in_transit deliveries
        if (
          deliveryData.status === "pending" ||
          deliveryData.status === "in_transit"
        ) {
          if (!deliveryData.trackingData) {
            deliveryData.trackingData = {};
          }
          deliveryData.trackingData.currentLocation = {
            type: "Point",
            coordinates:
              createdWarehouses[i % createdWarehouses.length].location
                .coordinates,
          };
        }
      }

      // Add created and updated timestamps
      deliveryData.createdAt = new Date();
      deliveryData.updatedAt = new Date();

      const delivery = new Delivery(deliveryData);
      await delivery.save();
      console.log(
        `Created delivery: ${delivery.trackingId} (Status: ${delivery.status})`
      );
    }

    // Update drivers with current deliveries
    console.log("Updating driver assignments...");
    for (const driver of drivers) {
      const driverDeliveries = await Delivery.find({
        driver: driver._id,
        status: { $in: ["pending", "in_transit"] },
      });

      driver.currentDeliveries = driverDeliveries.map((d) => d._id);
      driver.status = driverDeliveries.length > 0 ? "on_delivery" : "available";
      await driver.save();
      console.log(
        `Updated driver ${driver.name}: ${driverDeliveries.length} active deliveries`
      );
    }

    console.log("\nSeed completed successfully!");
    console.log(`Created: ${createdWarehouses.length} warehouses`);
    console.log(`Created: ${deliveries.length} deliveries`);
    console.log("\nDelivery Status Summary:");

    const statusCounts = await Delivery.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    statusCounts.forEach((stat) => {
      console.log(`  ${stat._id}: ${stat.count}`);
    });
  } catch (error) {
    console.error("Error seeding deliveries:", error);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed");
  }
};

// Only run if called directly
if (require.main === module) {
  seedDeliveries();
}

module.exports = seedDeliveries;
