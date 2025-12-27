// routes/trackingRoutes.js
const express = require("express");
const router = express.Router();
const trackingController = require("../controllers/trackingController");

/* ===============================
   MAIN PAGES
================================ */

// Home
router.get("/", trackingController.getHomePage);

// Tracking form
router.get("/track", trackingController.getTrackingPage);
router.post("/track", trackingController.postTrackingForm);

// Tracking results (QUERY STRING — matches frontend)
router.get("/track/results", trackingController.getTrackingResults);

// Live map (explicit param)
router.get("/live-map/:trackingId", trackingController.getLiveMap);

/* ===============================
   DELIVERY ACTIONS
================================ */

// Reschedule delivery
router.get(
  "/track/reschedule/:trackingId",
  trackingController.getRescheduleForm
);
router.post("/track/reschedule/:trackingId", trackingController.postReschedule);

// Redirect delivery
router.get("/track/redirect/:trackingId", trackingController.getRedirectForm);
router.post("/track/redirect/:trackingId", trackingController.postRedirect);

// Update contact info
router.get(
  "/track/update-contact/:trackingId",
  trackingController.getUpdateContact
);
router.post(
  "/track/update-contact/:trackingId",
  trackingController.postUpdateContact
);

/* ===============================
   SUPPORT & DOCUMENTS
================================ */

// Support
router.get("/track/support/:trackingId", trackingController.getSupportPage);
router.post(
  "/track/report-issue/:trackingId",
  trackingController.postReportIssue
);

// Invoice
router.get("/track/invoice/:trackingId", trackingController.getInvoice);

// Print delivery receipt
router.get("/track/print/:trackingId", trackingController.getPrintReceipt);

/* ===============================
   DRIVER
================================ */

router.get("/driver/dashboard", trackingController.getDriverDashboard);

module.exports = router;
