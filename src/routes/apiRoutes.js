const express = require("express");
const router = express.Router();
const { isAuthenticated, isAdmin } = require("../middlewares/auth");

// All admin routes require authentication and admin role
router.use(isAuthenticated);
router.use(isAdmin);

// ============================================
// API ENDPOINTS FOR AJAX REQUESTS (JSON responses)
// ============================================

// Get delivery stats for dashboard widgets
router.get("/api/deliveries/stats", async (req, res) => {
  try {
    const Delivery = require("../models/Delivery");

    const [
      totalDeliveries,
      pendingDeliveries,
      inTransitDeliveries,
      deliveredToday,
    ] = await Promise.all([
      Delivery.countDocuments({}),
      Delivery.countDocuments({ status: "pending" }),
      Delivery.countDocuments({ status: "in_transit" }),
      Delivery.countDocuments({
        status: "delivered",
        actualDelivery: {
          $gte: new Date().setHours(0, 0, 0, 0),
          $lt: new Date().setHours(23, 59, 59, 999),
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalDeliveries,
        pendingDeliveries,
        inTransitDeliveries,
        deliveredToday,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get recent deliveries for dashboard
router.get("/api/deliveries/recent", async (req, res) => {
  try {
    const Delivery = require("../models/Delivery");

    const recentDeliveries = await Delivery.find()
      .populate("driver", "name phone")
      .populate("vehicle", "plateNumber model")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: recentDeliveries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get available drivers for dropdown
router.get("/api/drivers/available", async (req, res) => {
  try {
    const Driver = require("../models/Driver");

    const availableDrivers = await Driver.find({
      status: { $in: ["available", "active"] },
    }).select("_id name phone email vehicle");

    res.json({
      success: true,
      data: availableDrivers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get available vehicles for dropdown
router.get("/api/vehicles/available", async (req, res) => {
  try {
    const Vehicle = require("../models/Vehicle");

    const availableVehicles = await Vehicle.find({
      status: { $in: ["available", "in_use"] },
    }).select("_id plateNumber model year capacity driver");

    res.json({
      success: true,
      data: availableVehicles,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
