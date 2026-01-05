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

module.exports = router;
