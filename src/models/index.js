const mongoose = require("mongoose");

// Export all models
module.exports = {
  Admin: require("./Admin"),
  Delivery: require("./Delivery"),
  Driver: require("./Driver"),
  Vehicle: require("./Vehicle"),
  Route: require("./Route"),
};
