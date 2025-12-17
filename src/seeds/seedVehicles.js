const mongoose = require("mongoose");
require("dotenv").config();

const Vehicle = require("../models/Vehicle");

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

const vehicles = [
  {
    plateNumber: "EDV001",
    make: "Ford",
    model: "Transit",
    year: 2023,
    type: "van",
    status: "active",
    currentLocation: {
      type: "Point",
      coordinates: [-73.9851, 40.7589],
      lastUpdated: new Date(),
    },
    capacity: { weight: 1500, volume: 12.5 },
    telemetry: {
      speed: 0,
      fuelLevel: 85,
      mileage: 12500,
      lastMaintenance: new Date("2024-01-15"),
    },
  },
  {
    plateNumber: "EDT002",
    make: "Mercedes-Benz",
    model: "Sprinter",
    year: 2022,
    type: "truck",
    status: "in_use",
    currentLocation: {
      type: "Point",
      coordinates: [-73.9934, 40.7505],
      lastUpdated: new Date(),
    },
    capacity: { weight: 2500, volume: 18.2 },
    telemetry: {
      speed: 32,
      fuelLevel: 65,
      mileage: 34200,
      lastMaintenance: new Date("2024-02-01"),
    },
  },
  {
    plateNumber: "EDC003",
    make: "Toyota",
    model: "Prius",
    year: 2023,
    type: "car",
    status: "active",
    currentLocation: {
      type: "Point",
      coordinates: [-73.9942, 40.7282],
      lastUpdated: new Date(),
    },
    capacity: { weight: 400, volume: 2.5 },
    telemetry: {
      speed: 0,
      fuelLevel: 90,
      mileage: 8900,
      lastMaintenance: new Date("2024-01-20"),
    },
  },
  {
    plateNumber: "EDM004",
    make: "Honda",
    model: "CB500X",
    year: 2023,
    type: "motorcycle",
    status: "maintenance",
    currentLocation: {
      type: "Point",
      coordinates: [-73.9776, 40.7614],
      lastUpdated: new Date(),
    },
    capacity: { weight: 150, volume: 0.8 },
    telemetry: {
      speed: 0,
      fuelLevel: 100,
      mileage: 15600,
      lastMaintenance: new Date("2024-03-01"),
    },
  },
  {
    plateNumber: "UKV101",
    make: "Volkswagen",
    model: "Crafter",
    year: 2023,
    type: "van",
    status: "active",
    currentLocation: {
      type: "Point",
      coordinates: [-0.1278, 51.5074],
      lastUpdated: new Date(),
    },
    capacity: { weight: 1600, volume: 13.1 },
    telemetry: {
      speed: 0,
      fuelLevel: 78,
      mileage: 9800,
      lastMaintenance: new Date("2024-03-12"),
    },
  },
  {
    plateNumber: "DETR202",
    make: "MAN",
    model: "TGL",
    year: 2021,
    type: "truck",
    status: "in_use",
    currentLocation: {
      type: "Point",
      coordinates: [13.405, 52.52],
      lastUpdated: new Date(),
    },
    capacity: { weight: 3500, volume: 22.0 },
    telemetry: {
      speed: 45,
      fuelLevel: 55,
      mileage: 55200,
      lastMaintenance: new Date("2024-02-14"),
    },
  },
  {
    plateNumber: "JP-CAR-303",
    make: "Nissan",
    model: "Leaf EV",
    year: 2024,
    type: "car",
    status: "active",
    currentLocation: {
      type: "Point",
      coordinates: [139.6503, 35.6762],
      lastUpdated: new Date(),
    },
    capacity: { weight: 400, volume: 2.8 },
    telemetry: {
      speed: 0,
      fuelLevel: 92,
      mileage: 4200,
      lastMaintenance: new Date("2024-04-01"),
    },
  },
  {
    plateNumber: "AUS-MOTO-12",
    make: "Yamaha",
    model: "MT-07",
    year: 2023,
    type: "motorcycle",
    status: "in_use",
    currentLocation: {
      type: "Point",
      coordinates: [151.2093, -33.8688],
      lastUpdated: new Date(),
    },
    capacity: { weight: 170, volume: 0.9 },
    telemetry: {
      speed: 28,
      fuelLevel: 70,
      mileage: 7600,
      lastMaintenance: new Date("2024-03-20"),
    },
  },
  {
    plateNumber: "NG-DEL-505",
    make: "Toyota",
    model: "HiAce",
    year: 2022,
    type: "van",
    status: "active",
    currentLocation: {
      type: "Point",
      coordinates: [3.3792, 6.5244],
      lastUpdated: new Date(),
    },
    capacity: { weight: 1200, volume: 10.0 },
    telemetry: {
      speed: 0,
      fuelLevel: 80,
      mileage: 21000,
      lastMaintenance: new Date("2024-04-10"),
    },
  },
  {
    plateNumber: "ZA-TRK-778",
    make: "Isuzu",
    model: "N-Series",
    year: 2020,
    type: "truck",
    status: "maintenance",
    currentLocation: {
      type: "Point",
      coordinates: [28.0473, -26.2041],
      lastUpdated: new Date(),
    },
    capacity: { weight: 3000, volume: 20.5 },
    telemetry: {
      speed: 0,
      fuelLevel: 50,
      mileage: 74000,
      lastMaintenance: new Date("2024-01-05"),
    },
  },
  {
    plateNumber: "BR-CAR-909",
    make: "Chevrolet",
    model: "Onix",
    year: 2023,
    type: "car",
    status: "active",
    currentLocation: {
      type: "Point",
      coordinates: [-46.6333, -23.5505],
      lastUpdated: new Date(),
    },
    capacity: { weight: 450, volume: 2.6 },
    telemetry: {
      speed: 0,
      fuelLevel: 88,
      mileage: 5100,
      lastMaintenance: new Date("2024-02-11"),
    },
  },
  {
    plateNumber: "UAE-VAN-121",
    make: "Hyundai",
    model: "H350",
    year: 2024,
    type: "van",
    status: "in_use",
    currentLocation: {
      type: "Point",
      coordinates: [55.2708, 25.2048],
      lastUpdated: new Date(),
    },
    capacity: { weight: 1700, volume: 14.3 },
    telemetry: {
      speed: 52,
      fuelLevel: 60,
      mileage: 6700,
      lastMaintenance: new Date("2024-03-05"),
    },
  },
  {
    plateNumber: "CA-MOTO-333",
    make: "BMW",
    model: "F900XR",
    year: 2023,
    type: "motorcycle",
    status: "active",
    currentLocation: {
      type: "Point",
      coordinates: [-79.3832, 43.6532],
      lastUpdated: new Date(),
    },
    capacity: { weight: 190, volume: 0.85 },
    telemetry: {
      speed: 0,
      fuelLevel: 75,
      mileage: 9100,
      lastMaintenance: new Date("2024-03-18"),
    },
  },
];

const seedVehicles = async () => {
  try {
    await connectDB();

    let createdCount = 0;
    let skippedCount = 0;

    for (const vehicleData of vehicles) {
      const existingVehicle = await Vehicle.findOne({
        plateNumber: vehicleData.plateNumber,
      });

      if (existingVehicle) {
        console.log(
          `Vehicle ${vehicleData.plateNumber} already exists, skipping...`
        );
        skippedCount++;
        continue;
      }

      const vehicle = new Vehicle(vehicleData);
      await vehicle.save();
      console.log(
        `✅ Created vehicle: ${vehicleData.plateNumber} (${vehicleData.model})`
      );
      createdCount++;
    }

    console.log("\n🎉 Vehicle seed completed!");
    console.log(`📊 Created: ${createdCount} vehicles`);
    console.log(`⏭️  Skipped: ${skippedCount} existing vehicles`);
  } catch (error) {
    console.error("❌ Error seeding vehicles:", error);
  } finally {
    mongoose.connection.close();
  }
};

if (require.main === module) seedVehicles();
module.exports = seedVehicles;
