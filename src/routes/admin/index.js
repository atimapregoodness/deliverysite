const express = require("express");
const router = express.Router();
const adminController = require("../../controllers/adminController");

const { isAuthenticated, isAdmin } = require("../../middlewares/auth");

// All admin routes require authentication and admin role
router.use(isAuthenticated);
router.use(isAdmin);

// ============================================
// DASHBOARD ROUTES
// ============================================

// Dashboard page
router.get("/", adminController.getDashboard);
router.get("/dashboard", adminController.getDashboard);
router.get("/settings", adminController.getSettings);

router.get("/settings/json", adminController.getSettingsJson);

// POST Routes
router.post("/settings/update", adminController.updateSettings);

// Import all admin route files
const driverRoutes = require("./driverRoutes");
const deliveryRoutes = require("./deliveryRoutes");
const warehouseRoutes = require("./warehouseRoutes");

// Mount routes
router.use("/drivers", driverRoutes);
router.use("/deliveries", deliveryRoutes);
router.use("/warehouses", warehouseRoutes);

module.exports = router;
