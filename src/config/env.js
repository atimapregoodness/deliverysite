const dotenv = require("dotenv");
dotenv.config();

const config = {
  port: process.env.PORT || 3000,
  mongodb: {
    uri:
      process.env.MONGODB_URI || "mongodb://localhost:27017/delivery_tracker",
  },
  cloudinary: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  },
  session: {
    secret: process.env.SESSION_SECRET || "delivery-tracker-secret",
    resave: false,
    saveUninitialized: false,
  },
  app: {
    name: "Express Delivery",
    baseUrl: process.env.BASE_URL || "http://localhost:3000",
  },
};

module.exports = config;
