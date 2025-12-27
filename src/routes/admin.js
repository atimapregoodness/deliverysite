const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { isAuthenticated, isAdmin } = require("../middlewares/auth");

// All admin routes require authentication and admin role
router.use(isAuthenticated);
router.use(isAdmin);

// For multipart/form-data, add multer
const multer = require("multer");
const upload = multer(); // No disk storage needed

// ============================================
// DASHBOARD ROUTES
// ============================================

// Dashboard page
router.get("/", adminController.getDashboard);
router.get("/dashboard", adminController.getDashboard);

// ============================================
// DELIVERY MANAGEMENT ROUTES
// ============================================

// List all deliveries with filtering, search, and pagination
router.get("/deliveries", adminController.listDeliveries);

// Create new delivery
router.get("/deliveries/create", adminController.showCreateForm);
router.post("/deliveries/create", adminController.createDelivery);

// Single delivery operations - Main delivery details page
router.get("/deliveries/:id", adminController.getDeliveryDetails);

// Modal operations for AJAX requests (return JSON)
router.post("/deliveries/:id/update", adminController.updateDelivery); // Edit modal
router.post(
  "/deliveries/:id/update-status",
  adminController.updateDeliveryStatus
); // Status modal
router.post(
  "/deliveries/:id/add-incident",
  upload.none(),
  adminController.addIncident
); // Incident modal
router.post("/deliveries/:id/update-location", adminController.updateLocation); // Location modal
router.post("/deliveries/:id/assign-driver", adminController.assignDriver); // Driver modal

// Quick actions (return JSON for AJAX)
router.post("/deliveries/:id/geocode", adminController.geocodeAddresses);
router.post("/deliveries/:id/mark-delivered", adminController.markAsDelivered);
router.post("/deliveries/:id/cancel", adminController.cancelDelivery);

// Resolve incident
router.post(
  "/deliveries/:id/incidents/:incidentId/resolve",
  adminController.resolveIncident
);

// Add this route to your routes file
router.post(
  "/deliveries/:id/incidents/:incidentIndex/delete",
  adminController.deleteIncident
);

// Delete delivery (AJAX)
router.delete("/deliveries/:id", adminController.deleteDelivery);

// ============================================
// warehouse MANAGEMENT ROUTES
// ============================================

// warehouse management
router.get("/warehouse", adminController.getAllWarehouses);
// router.post("/warehouses", adminController.createwarehouse);

// ============================================
// DRIVER MANAGEMENT ROUTES
// ============================================

// Driver management
router.get("/drivers", adminController.getAllDrivers);
// router.post("/drivers", adminController.createDriver);

module.exports = router;
