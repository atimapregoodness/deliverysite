const seedAdmins = require("./seedAdmin");
const seedDrivers = require("./seedDrivers");
const seedVehicles = require("./seedVehicles");
const seedDeliveries = require("./seedDeliveries");

const seedAll = async () => {
  console.log("🌱 Starting database seeding...\n");

  try {
    // console.log("1. Seeding admin users...");
    // await seedAdmins();

    console.log("\n2. Seeding drivers...");
    await seedDrivers();

    console.log("\n3. Seeding vehicles...");
    await seedVehicles();

    console.log("\n4. Seeding deliveries...");
    await seedDeliveries();

    console.log("\n🎉 All seeding completed successfully!");
    console.log("\n📋 Next steps:");
    console.log("   - Run: npm start");
    console.log("   - Visit: http://localhost:3000 for customer tracking");
    console.log("   - Visit: http://localhost:3000/admin for admin dashboard");
    console.log("   - Login with: superadmin@expressdelivery.com / Admin123!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  }
};

if (require.main === module) {
  seedAll();
}

module.exports = seedAll;
