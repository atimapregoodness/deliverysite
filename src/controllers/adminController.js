const { Delivery, Warehouse, Driver } = require("../models");
const Settings = require("../models/Settings"); // Add this import
const mongoose = require("mongoose");

class AdminController {
  // Dashboard - Simplified version
  getDashboard = async (req, res) => {
    try {
      const data = await this.getDashboardInternalData();

      // If API request
      if (req.xhr || req.headers.accept?.includes("application/json")) {
        return res.json({
          success: true,
          data: {
            stats: data.stats,
            recentActivities: data.recentActivities,
            counts: data.counts,
            todayStats: data.todayStats,
          },
        });
      }

      // Render HTML page
      res.render("admin/dashboard", {
        title: "Dashboard",
        stats: data.stats,
        recentActivities: data.recentActivities,
        counts: data.counts,
        todayStats: data.todayStats,
        admin: req.user,
      });
    } catch (error) {
      console.error("Dashboard Error:", error);

      // API response
      if (req.xhr || req.headers.accept?.includes("application/json")) {
        return res.status(500).json({
          success: false,
          error: "Failed to load dashboard data",
        });
      }

      // HTML response
      res.render("admin/dashboard", {
        title: "Dashboard",
        error_msg: "Failed to load dashboard",
        stats: {},
        recentActivities: [],
        counts: {},
        todayStats: {},
        admin: req.user || null,
      });
    }
  };

  async getDashboardInternalData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get only essential data
    const [
      totalDeliveries,
      activeDeliveries,
      pendingDeliveries,
      todayDeliveries,
      totalDrivers,
      availableDrivers,
      totalWarehouses,
    ] = await Promise.all([
      Delivery.countDocuments(),
      Delivery.countDocuments({ status: "in_transit" }),
      Delivery.countDocuments({ status: "pending" }),
      Delivery.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
      Driver.countDocuments(),
      Driver.countDocuments({ status: "available" }),
      Warehouse.countDocuments(),
    ]);

    // Get only 5 latest deliveries (as requested)
    const recentActivities = await Delivery.find()
      .populate("driver", "name")
      .populate("warehouse", "name")
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();

    return {
      stats: {
        totalDeliveries,
        activeDeliveries,
        pendingDeliveries,
        todayDeliveries,
        totalDrivers,
        availableDrivers,
        totalWarehouses,
      },
      recentActivities,
      counts: {
        deliveries: totalDeliveries,
        drivers: totalDrivers,
        warehouses: totalWarehouses,
      },
      todayStats: {
        newDeliveries: todayDeliveries,
      },
    };
  }

  // API endpoint for dashboard stats
  getDashboardStats = async (req, res) => {
    try {
      const data = await this.getDashboardInternalData();
      res.json({
        success: true,
        data: {
          stats: data.stats,
          recentActivities: data.recentActivities,
          counts: data.counts,
          todayStats: data.todayStats,
        },
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({
        success: false,
        error: "Failed to load dashboard stats",
      });
    }
  };

  // Simplified counts endpoint
  getCounts = async (req, res) => {
    try {
      const [deliveries, drivers, warehouses] = await Promise.all([
        Delivery.countDocuments(),
        Driver.countDocuments(),
        Warehouse.countDocuments(),
      ]);

      res.json({
        success: true,
        data: { deliveries, drivers, warehouses },
      });
    } catch (error) {
      console.error("Error fetching counts:", error);
      res.status(500).json({
        success: false,
        error: "Failed to load counts",
      });
    }
  };

  // Get only 5 recent activities
  getRecentActivities = async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 5;

      const recentActivities = await Delivery.find()
        .populate("driver", "name")
        .populate("warehouse", "name")
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();

      res.json({
        success: true,
        data: recentActivities,
      });
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      res.status(500).json({
        success: false,
        error: "Failed to load recent activities",
      });
    }
  };

  // Simple system health check
  getSystemHealth = async (req, res) => {
    try {
      const health = {
        database:
          mongoose.connection.readyState === 1 ? "connected" : "disconnected",
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: health,
      });
    } catch (error) {
      console.error("Error checking system health:", error);
      res.status(500).json({
        success: false,
        error: "Failed to check system health",
      });
    }
  };

  // GET settings page
  getSettings = async (req, res) => {
    try {
      const settings = await Settings.getSettings();
      res.render("admin/settings", {
        title: "Settings",
        appSettings: settings ? settings.toObject() : {}, // Renamed to avoid conflict
        messages: {
          success: req.flash("success"),
          error: req.flash("error"),
        },
      });
    } catch (error) {
      console.error("Error loading settings:", error);
      req.flash("error", "Failed to load settings");
      res.redirect("/admin/dashboard");
    }
  };

  // POST update settings
  updateSettings = async (req, res) => {
    try {
      const { adminEmail, supportEmail } = req.body;

      // Validate required fields
      if (!adminEmail || !adminEmail.includes("@")) {
        req.flash("error", "Valid admin email is required");
        return res.redirect("/admin/settings");
      }

      if (!supportEmail || !supportEmail.includes("@")) {
        req.flash("error", "Valid support email is required");
        return res.redirect("/admin/settings");
      }

      // Process companyAddress if it's a string
      if (
        req.body.companyAddress &&
        typeof req.body.companyAddress === "string"
      ) {
        try {
          req.body.companyAddress = JSON.parse(req.body.companyAddress);
        } catch (e) {
          // If parsing fails, use empty object
          req.body.companyAddress = {};
        }
      }

      // Update settings
      await Settings.updateSettings(req.body);

      req.flash("success", "Settings updated successfully");
      res.redirect("/admin/settings");
    } catch (error) {
      console.error("Error updating settings:", error);
      req.flash("error", "Failed to update settings");
      res.redirect("/admin/settings");
    }
  };

  // GET settings as JSON (API endpoint)
  getSettingsJson = async (req, res) => {
    try {
      const settings = await Settings.getSettings();
      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      console.error("Error getting settings:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch settings",
      });
    }
  };
}

module.exports = new AdminController();
