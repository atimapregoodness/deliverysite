const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Admin model
const Admin = require("../models/Admin");

// Database connection
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

// Single admin user with credentials from environment variables
const createSingleAdmin = async () => {
  try {
    await connectDB();

    // Get admin credentials from environment variables with defaults
    const adminConfig = {
      username: process.env.ADMIN_USERNAME || "admin",
      email: process.env.ADMIN_EMAIL || "admin@galaxyfinance.com",
      password: process.env.ADMIN_PASSWORD || "Admin123!",
      firstName: process.env.ADMIN_FIRST_NAME || "System",
      lastName: process.env.ADMIN_LAST_NAME || "Administrator",
      phone: process.env.ADMIN_PHONE || "+1-555-0100",
    };

    // Validate that required environment variables are present
    if (!process.env.ADMIN_PASSWORD) {
      console.warn(
        "⚠️  ADMIN_PASSWORD not set in .env, using default password"
      );
    }

    if (!process.env.ADMIN_EMAIL) {
      console.warn("⚠️  ADMIN_EMAIL not set in .env, using default email");
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      $or: [{ email: adminConfig.email }, { username: adminConfig.username }],
    });

    if (existingAdmin) {
      console.log(`✅ Admin already exists: ${adminConfig.email}`);
      console.log(`📧 Email: ${existingAdmin.email}`);
      console.log(`👤 Username: ${existingAdmin.username}`);
      console.log(`🎯 Role: ${existingAdmin.role}`);
      console.log(
        `🔓 Status: ${existingAdmin.isActive ? "Active" : "Inactive"}`
      );

      // Verify the admin can login with current password
      const isValidPassword = await bcrypt.compare(
        adminConfig.password,
        existingAdmin.password
      );

      if (isValidPassword) {
        console.log("🔐 Password: Verified (matches current .env password)");
      } else {
        console.log("❌ Password: Does not match .env password");
        console.log(
          "💡 To update password, change ADMIN_PASSWORD in .env and run this script again"
        );
      }

      return;
    }

    // Create new admin with schema-compatible data
    const adminData = {
      username: adminConfig.username,
      email: adminConfig.email,
      password: adminConfig.password, // Will be hashed by the model's pre-save hook
      role: "superadmin",
      permissions: [
        "manage_deliveries",
        "manage_drivers",
        "manage_vehicles",
        "view_analytics",
        "manage_routes",
        "system_settings",
      ], // Only using permissions from schema enum
      profile: {
        firstName: adminConfig.firstName,
        lastName: adminConfig.lastName,
        phone: adminConfig.phone,
        // avatar is optional, so we don't include it
      },
      isActive: true,
      loginAttempts: 0,
      // lockUntil is not set initially
      lastLogin: null, // Will be set on first login
    };

    const admin = new Admin(adminData);
    await admin.save();

    console.log("🎉 Super Admin created successfully!");
    console.log("=====================================");
    console.log(`📧 Email: ${adminConfig.email}`);
    console.log(`👤 Username: ${adminConfig.username}`);
    console.log(`🔐 Password: ${adminConfig.password}`);
    console.log(`🎯 Role: superadmin`);
    console.log(`📞 Phone: ${adminConfig.phone}`);
    console.log(`👤 Name: ${adminConfig.firstName} ${adminConfig.lastName}`);
    console.log(`🔓 Status: Active`);
    console.log(`🔑 Permissions: ${adminData.permissions.length} total`);

    console.log("\n📋 Granted Permissions:");
    adminData.permissions.forEach((perm) => {
      console.log(`   • ${perm}`);
    });

    console.log("\n⚠️  Important: Keep these credentials secure!");
    console.log("💡 You can change the password in your .env file");
  } catch (error) {
    console.error("❌ Error creating admin user:", error);

    // More detailed error logging
    if (error.code === 11000) {
      console.log(
        "💡 Duplicate key error - admin with this email or username already exists"
      );
    }

    if (error.name === "ValidationError") {
      console.log(
        "💡 Validation error - check that all fields match the schema requirements"
      );
      Object.keys(error.errors).forEach((field) => {
        console.log(`   - ${field}: ${error.errors[field].message}`);
      });
    }
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log("\nDatabase connection closed");
    }
  }
};

// Run seed function if script is executed directly
if (require.main === module) {
  createSingleAdmin();
}

module.exports = createSingleAdmin;
