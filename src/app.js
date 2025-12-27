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
const setupDeliverySockets = require("./sockets/deliverySocket");
const formatDate = require("./utils/formatDate");
const Delivery = require("./models/Delivery");

// Initialize app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

/* ==============================
   REQUIRED FOR VERCEL / PROXIES
================================ */
app.set("trust proxy", 1);

// Connect to database
connectDB();

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Compression
app.use(compression());

/* ==============================
   RATE LIMITING (SAFE)
================================ */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

/* ==============================
   DEBUG (OPTIONAL)
================================ */
app.use((req, res, next) => {
  if (req.method === "POST" && req.url.includes("add-incident")) {
    console.log("=== FORM SUBMISSION DEBUG ===");
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Body:", req.body);
    console.log("=== END DEBUG ===");
  }
  next();
});

/* ==============================
   MULTIPART FALLBACK (SAFE)
================================ */
app.use((req, res, next) => {
  if (req.headers["content-type"]?.startsWith("multipart/form-data")) {
    const busboy = require("busboy");
    const bb = busboy({ headers: req.headers });
    const fields = {};

    bb.on("field", (name, val) => {
      fields[name] = val;
    });

    bb.on("finish", () => {
      req.body = fields;
      next();
    });

    req.pipe(bb);
  } else {
    next();
  }
});

/* ==============================
   SESSION
================================ */
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
      ttl: 12 * 60 * 60, // ⏱️ 12 HOURS IN SECONDS
      autoRemove: "native",
    }),

    cookie: {
      maxAge: 12 * 60 * 60 * 1000, // ⏱️ 12 HOURS
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

/* ==============================
   PASSPORT
================================ */
require("./config/passport");
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

/* ==============================
   STATIC FILES
================================ */
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ==============================
   VIEW ENGINE
================================ */
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

/* ==============================
   GLOBAL LOCALS
================================ */

// Use the middleware (place before routes)

app.use(require("./middlewares/currentPage"));

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
  } catch (err) {
    console.error("Global middleware error:", err);
    next();
  }
});

/* ==============================
   ROUTES
================================ */
app.use("/", require("./routes/web"));
app.use("/delivery", require("./routes/tracking"));
app.use("/auth", require("./routes/auth"));
app.use("/admin", require("./routes/admin"));

// Test route to check currentPage values
app.get("/test-current-page", (req, res) => {
  const testPaths = [
    "/",
    "/track",
    "/delivery/track/123",
    "/about",
    "/contact",
    "/security-services",
    "/security/static-guards",
    "/logistics-services",
    "/logistics/freight-forwarding",
    "/company",
    "/company/leadership",
  ];

  const results = testPaths.map((path) => {
    // Simulate the middleware logic
    let currentPage = "home";
    if (path === "/" || path === "") {
      currentPage = "home";
    } else if (path.startsWith("/track")) {
      currentPage = "track";
    } else if (path.startsWith("/delivery/track")) {
      currentPage = "delivery/track";
    } else if (path.startsWith("/security")) {
      currentPage = "security";
    } else if (path.startsWith("/logistics")) {
      currentPage = "logistics";
    } else if (
      path.startsWith("/company") ||
      path.startsWith("/about") ||
      path.startsWith("/contact")
    ) {
      currentPage = "company";
    }

    return { path, currentPage };
  });

  res.json(results);
});
/* ==============================
   SOCKET.IO
================================ */
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
setupDeliverySockets(io);

/* ==============================
   ERROR HANDLERS
================================ */
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

/* ==============================
   START SERVER
================================ */
server.listen(config.port, () => {
  console.log(`🚀 Server running on port ${config.port}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;
