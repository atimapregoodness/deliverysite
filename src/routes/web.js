const express = require("express");
const router = express.Router();

// Public routes
router.get("/", (req, res) => {
  res.render("pages/home", {
    title: "Express Delivery - Track Your Package",
    user: req.user,
  });
});

router.get("/track", (req, res) => {
  res.render("pages/track-form", {
    title: "Track Your Delivery",
    error: req.flash("error"),
  });
});

router.post("/track", (req, res) => {
  const { trackingId } = req.body;
  if (!trackingId) {
    req.flash("error", "Please enter a tracking ID");
    return res.redirect("/track");
  }
  res.redirect(`/track/${trackingId}`);
});

module.exports = router;
