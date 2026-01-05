const express = require("express");
const session = require("express-session");
const passport = require("passport");
const flash = require("connect-flash");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const mongoose = require("mongoose");
const ejsMate = require("ejs-mate");

const config = require("./config/env");
const connectDB = require("./config/database");

const formatDate = require("./utils/formatDate");
const Delivery = require("./models/Delivery");

const { cachedAdminCountsMiddleware } = require("./middlewares/adminCounts");
const { loadSettings } = require("./middlewares/settingsMiddleware");
const currentPageMiddleware = require("./middlewares/currentPage");

// Initialize app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Trust proxy for production
app.set("trust proxy", 1);

// Connect to DB
connectDB();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Method override
const methodOverride = require("method-override");
app.use(methodOverride("_method"));

// Compression
app.use(compression());

// Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Sessions
const MongoStore = require("connect-mongo");
app.use(
  session({
    name: "delivery.sid",
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: config.mongodb.uri,
      collectionName: "sessions",
      ttl: 12 * 60 * 60,
      autoRemove: "native",
    }),
    cookie: {
      maxAge: 12 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

// Passport
require("./config/passport");
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// Static files
app.use(express.static(path.join(__dirname, "public")));

// View engine
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views")); // src/views

// ==============================
// GLOBAL MIDDLEWARES
// ==============================

// Load all settings from schema
app.use(loadSettings);

// Current page helper
app.use(currentPageMiddleware);

// Cached admin counts
app.use(cachedAdminCountsMiddleware);

// Global locals
app.use(async (req, res, next) => {
  try {
    res.locals.currentUser = req.user || null;
    res.locals.user = req.user || null;
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.baseUrl = config.app.baseUrl;
    res.locals.mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    res.locals.env = process.env;
    res.locals.admin = req.user;
    res.locals.title = "Shield Logistics - Secure Delivery Solutions";

    const pathParts = req.path.split("/").filter(Boolean);
    res.locals.currentPage =
      pathParts.length > 0 ? pathParts[pathParts.length - 1] : "home";

    res.locals.deliveryCount = await Delivery.countDocuments();

    app.locals.formatDate = formatDate;
    app.locals.getStatusColor = (status) => {
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
  } catch (err) {
    console.error("Global middleware error:", err);
    next();
  }
});

// ==============================
// ROUTES
// ==============================
app.use("/", require("./routes/web"));
app.use("/delivery", require("./routes/tracking"));
app.use("/auth", require("./routes/auth"));
app.use("/admin", require("./routes/admin/index"));

// ==============================
// SOCKET.IO
// ==============================
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("admin-join-delivery", (trackingId) => {
    socket.join(`delivery_${trackingId}`);
    socket.join("admin_monitoring");
  });

  socket.on("admin-control-vehicle", (data) => {
    io.to(`delivery_${data.deliveryId}`).emit("vehicle-controlled", {
      ...data,
      timestamp: new Date(),
      source: "admin",
    });
  });

  socket.on("admin-control-simulation", (data) => {
    io.to(`delivery_${data.deliveryId}`).emit("simulation-command", {
      ...data,
      timestamp: new Date(),
      source: "admin",
    });
  });
});

app.set("io", io);

// ==============================
// ERROR HANDLERS
// ==============================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("pages/error", {
    title: "Error",
    message: "Something went wrong",
    error: process.env.NODE_ENV === "development" ? err : {},
  });
});

app.use((req, res) => {
  res.status(404).render("pages/404", {
    title: "Page Not Found",
  });
});

// ==============================
// START SERVER
// ==============================
server.listen(config.port, () => {
  console.log(`🚀 Server running on port ${config.port}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;
