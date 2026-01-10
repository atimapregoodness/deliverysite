const express = require("express");
const router = express.Router();

// Public routes
router.get("/", (req, res) => {
  res.render("pages/home", {
    title: "Express Delivery - Track Your Package",
    user: req.user,
  });
});

// Public routes
router.get("/track", (req, res) => {
  res.render("pages/track-form", {
    title: "Express Delivery - Track Your Package",
    user: req.user,
  });
});

// Security routes
router.get("/security/static-guards", (req, res) => {
  res.render("pages/security/static-guards", { currentPage: "security" });
});

router.get("/security/mobile-patrols", (req, res) => {
  res.render("pages/security/mobile-patrols", { currentPage: "security" });
});

router.get("/security/alarm-monitoring", (req, res) => {
  res.render("pages/security/alarm-monitoring", { currentPage: "security" });
});

router.get("/security/cctv", (req, res) => {
  res.render("pages/security/cctv", { currentPage: "security" });
});

router.get("/security/cyber", (req, res) => {
  res.render("pages/security/cyber", { currentPage: "security" });
});

// Logistics routes
router.get("/logistics/freight-forwarding", (req, res) => {
  res.render("pages/logistics/freight-forwarding", {
    currentPage: "logistics",
  });
});

router.get("/logistics/warehousing", (req, res) => {
  res.render("pages/logistics/warehousing", { currentPage: "logistics" });
});

router.get("/logistics/distribution", (req, res) => {
  res.render("pages/logistics/distribution", { currentPage: "logistics" });
});

router.get("/logistics/cold-chain", (req, res) => {
  res.render("pages/logistics/cold-chain", { currentPage: "logistics" });
});

router.get("/logistics/supply-chain", (req, res) => {
  res.render("pages/logistics/supply-chain", { currentPage: "logistics" });
});

// Company routes
router.get("/about", (req, res) => {
  res.render("pages/company/about", { currentPage: "company" });
});

router.get("/contact", (req, res) => {
  res.render("pages/company/contact", { currentPage: "company" });
});

router.get("/company/certifications", (req, res) => {
  res.render("pages/company/certifications", { currentPage: "company" });
});

module.exports = router;
