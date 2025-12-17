const express = require("express");
const session = require("express-session");
const passport = require("passport");
const flash = require("connect-flash");
// const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const mongoose = require("mongoose");
const ejsMate = require("ejs-mate");

const config = require("./config/env");
const connectDB = require("./config/database");
const setupDeliverySockets = require("./sockets/deliverySocket");

// Initialize app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Connect to database
connectDB();

// // Security middleware
// app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: config.session.secret,
    resave: config.session.resave,
    saveUninitialized: config.session.saveUninitialized,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// In your Socket.IO connection handler
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Admin joins delivery monitoring room
  socket.on("admin-join-delivery", (trackingId) => {
    socket.join(`delivery_${trackingId}`);
    socket.join("admin_monitoring");
    console.log(`Admin ${socket.id} joined delivery monitoring: ${trackingId}`);
  });

  // Admin control actions
  socket.on("admin-control-vehicle", async (data) => {
    try {
      const { deliveryId, action, value } = data;

      // Emit control to all users tracking this delivery
      io.to(`delivery_${deliveryId}`).emit("vehicle-controlled", {
        action,
        value,
        timestamp: new Date(),
        source: "admin",
      });
    } catch (error) {
      console.error("Error handling admin control:", error);
    }
  });

  // Admin simulation control
  socket.on("admin-control-simulation", async (data) => {
    try {
      const { deliveryId, command, parameters } = data;

      // Emit simulation control to all users
      io.to(`delivery_${deliveryId}`).emit("simulation-command", {
        command,
        parameters,
        timestamp: new Date(),
        source: "admin",
      });
    } catch (error) {
      console.error("Error handling simulation control:", error);
    }
  });
});
// Passport configuration
require("./config/passport");
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// Static files
app.use(express.static(path.join(__dirname, "/public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// View engine setup
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const formatDate = require("./utils/formatDate");

const Delivery = require("./models/Delivery");

// Global middleware to set res.locals
app.use(async (req, res, next) => {
  try {
    // Make the logged-in admin available globally
    res.locals.user = req.user || null;

    // Current page (you already use this)
    res.locals.currentPage = req.path;

    // Global delivery count
    res.locals.deliveryCount = await Delivery.countDocuments();

    next();
  } catch (err) {
    console.error("Global middleware error:", err);
    next();
  }
});

// Global variables
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.baseUrl = config.app.baseUrl;

  res.locals.mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;

  const path = req.path.split("/").filter(Boolean); // remove empty parts

  res.locals.currentPage = path.length > 0 ? path[path.length - 1] : "home";

  res.locals.admin = req.user || null; // logged-in user
  res.locals.admin = req.user || null; // logged-in user

  // Make formatDate available globally in EJS templates
  app.locals.formatDate = formatDate;
  app.locals.getStatusColor = function (status) {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "picked_up":
        return "bg-blue-500";
      case "in_transit":
        return "bg-indigo-500";
      case "out_for_delivery":
        return "bg-purple-500";
      case "delivered":
        return "bg-green-500";
      case "delayed":
        return "bg-red-500";
      case "cancelled":
        return "bg-gray-500";
      default:
        return "bg-gray-400";
    }
  };

  next();
});

app.use((req, res, next) => {
  res.locals.env = process.env;
  next();
});

// Routes
app.use("/", require("./routes/web"));
app.use("/delivery", require("./routes/tracking"));
app.use("/auth", require("./routes/auth"));
app.use("/admin", require("./routes/admin"));

// Store io instance in app for use in routes
app.set("io", io);

// Socket setup
setupDeliverySockets(io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error stack:", err.stack);
  res.status(500).render("pages/error", {
    title: "Error",
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err : {},
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render("pages/404", {
    title: "Page Not Found",
  });
});

// Start server
server.listen(config.port, () => {
  console.log(`🚀 Server running on port ${config.port}`);
  console.log(`📁 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🌐 Base URL: ${config.app.baseUrl}`);
});

module.exports = app;
