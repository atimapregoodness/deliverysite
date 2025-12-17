const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { isAuthenticated, isAdmin } = require("../middlewares/auth");

// All admin routes require authentication and admin role
router.use(isAuthenticated);
router.use(isAdmin);

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
router.post("/deliveries/:id/add-incident", adminController.addIncident); // Incident modal
router.post("/deliveries/:id/update-location", adminController.updateLocation); // Location modal
router.post("/deliveries/:id/assign-driver", adminController.assignDriver); // Driver modal

// Quick actions (return JSON for AJAX)
router.post("/deliveries/:id/geocode", adminController.geocodeAddresses);
router.post("/deliveries/:id/mark-delivered", adminController.markAsDelivered);
router.post("/deliveries/:id/cancel", adminController.cancelDelivery);
router.post(
  "/deliveries/:id/incidents/:incidentId/resolve",
  adminController.resolveIncident
);

// Delete delivery (AJAX)
router.delete("/deliveries/:id", adminController.deleteDelivery);

// Print delivery details
router.get("/deliveries/:id/print", async (req, res) => {
  try {
    const Delivery = require("../models/Delivery");
    const delivery = await Delivery.findById(req.params.id)
      .populate("driver", "name phone")
      .populate("vehicle", "plateNumber model")
      .lean();

    if (!delivery) {
      req.flash("error", "Delivery not found");
      return res.redirect("/admin/deliveries");
    }

    res.render("admin/print-delivery", {
      delivery,
      formatDate: (date) => {
        return new Date(date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      },
    });
  } catch (error) {
    console.error("Error generating print view:", error);
    req.flash("error", "Error generating print view");
    res.redirect("/admin/deliveries");
  }
});

// ============================================
// VEHICLE MANAGEMENT ROUTES
// ============================================

// Vehicle management
router.get("/vehicles", adminController.getAllVehicles);
// router.post("/vehicles", adminController.createVehicle);

// ============================================
// DRIVER MANAGEMENT ROUTES
// ============================================

// Driver management
router.get("/drivers", adminController.getAllDrivers);
// router.post("/drivers", adminController.createDriver);

module.exports = router;
