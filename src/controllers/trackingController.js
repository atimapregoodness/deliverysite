// controllers/trackingController.js
const Delivery = require("../models/Delivery");
const Driver = require("../models/Driver");
const Warehouse = require("../models/Warehouse"); // Add this import
const { generateTrackingId, formatStatus } = require("../utils/deliveryUtils");

/* ============================
   STANDALONE HELPER FUNCTIONS
============================ */

// Standalone generateTimeline function
function generateTimeline(delivery) {
  const timeline = [
    {
      title: "Order Created",
      description: "Package information received and processed",
      timestamp: delivery.createdAt,
      status: "completed",
      icon: "fa-box",
      location: "Warehouse Facility",
    },
  ];

  // Add processing event
  if (["in_transit", "delivered", "delayed"].includes(delivery.status)) {
    timeline.push({
      title: "Package Processed",
      description: "Package sorted and prepared for shipping",
      timestamp: new Date(delivery.createdAt.getTime() + 30 * 60000),
      status: "completed",
      icon: "fa-conveyor-belt",
      location: "Sorting Center",
    });

    timeline.push({
      title: "Package Picked Up",
      description: "Driver collected package from sender",
      timestamp: new Date(delivery.createdAt.getTime() + 60 * 60000),
      status: "completed",
      icon: "fa-truck-pickup",
      location: "Pickup Location",
    });
  }

  // Add transit events
  if (delivery.trackingData?.waypoints?.length > 0) {
    delivery.trackingData.waypoints.forEach((waypoint, index) => {
      if (waypoint.arrived && waypoint.timestamp) {
        timeline.push({
          title: `Arrived at ${waypoint.name || `Checkpoint ${index + 1}`}`,
          description: `Package passed through ${
            waypoint.name || "checkpoint"
          }`,
          timestamp: waypoint.timestamp,
          status: "completed",
          icon: "fa-map-marker-alt",
          location: waypoint.name || "Transit Point",
        });
      }
    });
  }

  // Add incidents
  if (delivery.incidents?.length > 0) {
    delivery.incidents.forEach((incident) => {
      timeline.push({
        title: `Incident: ${incident.type}`,
        description: incident.description,
        timestamp: incident.reportedAt,
        status: incident.resolved ? "completed" : "warning",
        icon: "fa-exclamation-triangle",
        location: incident.address || "En Route",
      });
    });
  }

  // Add current status event
  if (delivery.status === "in_transit") {
    timeline.push({
      title: "In Transit",
      description: "Package is on the way to delivery location",
      timestamp: new Date(),
      status: "current",
      icon: "fa-truck-moving",
      location: "En Route",
    });
  }

  if (delivery.status === "delayed") {
    timeline.push({
      title: "Delivery Delayed",
      description:
        delivery.delayInfo?.description ||
        "Delivery delayed due to unforeseen circumstances",
      timestamp: delivery.delayInfo?.reportedAt || new Date(),
      status: "warning",
      icon: "fa-clock",
      location: "En Route",
    });
  }

  // Add estimated delivery
  timeline.push({
    title: "Estimated Delivery",
    description: "Expected delivery window",
    timestamp:
      delivery.estimatedDelivery || new Date(Date.now() + 2 * 60 * 60 * 1000),
    status: delivery.status === "delivered" ? "completed" : "pending",
    icon: "fa-clock",
    location: "Delivery Location",
  });

  // Add actual delivery if delivered
  if (delivery.status === "delivered" && delivery.actualDelivery) {
    timeline.push({
      title: "Package Delivered",
      description: "Package successfully delivered to recipient",
      timestamp: delivery.actualDelivery,
      status: "completed",
      icon: "fa-check-circle",
      location: "Delivery Location",
      signature: delivery.receiver?.signatureRequired
        ? "Signature obtained"
        : null,
    });
  }

  // Sort by timestamp
  return timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// Standalone calculateProgress function
function calculateProgress(status, routeProgress) {
  switch (status) {
    case "pending":
      return 10;
    case "in_transit":
      return Math.max(20, Math.min(90, routeProgress || 50));
    case "delayed":
      return Math.max(30, Math.min(80, routeProgress || 40));
    case "delivered":
      return 100;
    default:
      return 0;
  }
}

// Standalone getWeatherData function
async function getWeatherData(lat, lng) {
  // Mock weather data - in production, integrate with weather API
  const conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Rainy", "Stormy"];
  const randomCondition =
    conditions[Math.floor(Math.random() * conditions.length)];

  const icons = {
    Sunny: "fa-sun",
    "Partly Cloudy": "fa-cloud-sun",
    Cloudy: "fa-cloud",
    Rainy: "fa-cloud-rain",
    Stormy: "fa-bolt",
  };

  return {
    condition: randomCondition,
    temperature: 18 + Math.floor(Math.random() * 15), // 18-32°C
    feelsLike: 20 + Math.floor(Math.random() * 15),
    humidity: 40 + Math.floor(Math.random() * 40),
    windSpeed: 5 + Math.floor(Math.random() * 20),
    windDirection: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][
      Math.floor(Math.random() * 8)
    ],
    icon: icons[randomCondition] || "fa-cloud",
    forecast: `${randomCondition} conditions expected for delivery`,
  };
}

// Standalone getTrafficConditions function
function getTrafficConditions() {
  const levels = ["light", "moderate", "heavy"];
  const randomLevel = levels[Math.floor(Math.random() * levels.length)];

  const delays = {
    light: 0,
    moderate: 10,
    heavy: 25,
  };

  const suggestions = {
    light: ["Clear roads, normal travel time"],
    moderate: [
      "Minor delays expected",
      "Consider alternative routes during peak hours",
    ],
    heavy: [
      "Significant delays expected",
      "Alternative routes recommended",
      "Allow extra travel time",
    ],
  };

  const colors = {
    light: "#10b981",
    moderate: "#f59e0b",
    heavy: "#ef4444",
  };

  return {
    level: randomLevel,
    delay: delays[randomLevel],
    description: `${
      randomLevel.charAt(0).toUpperCase() + randomLevel.slice(1)
    } traffic conditions`,
    color: colors[randomLevel],
    suggestions: suggestions[randomLevel],
  };
}

/* ============================
   CONTROLLER CLASS
============================ */

class TrackingController {
  // GET / - Home page with tracking form
  async getHomePage(req, res) {
    try {
      res.render("pages/home", {
        title: "ExpressLog - Track Your Delivery",
        page: "home",
        error: req.query.error || null,
        success: req.query.success || null,
      });
    } catch (error) {
      console.error("Home page error:", error);
      res.render("pages/home", {
        title: "ExpressLog - Track Your Delivery",
        page: "home",
        error: "Unable to load page",
      });
    }
  }

  // GET /track - Tracking form page
  async getTrackingPage(req, res) {
    res.render("pages/track-form", {
      title: "Track Delivery - ExpressLog",
      page: "tracking",
      sampleTrackingIds: [
        "DEL-51434020-X3RY",
        "DEL-62389145-B8TZ",
        "DEL-98701234-K9LX",
      ],
      error: req.query.error || null,
      trackingId: req.query.trackingId || "",
    });
  }

  // POST /track - Process tracking form with AJAX support
  async postTrackingForm(req, res) {
    try {
      let { trackingId } = req.body;

      // Normalize
      trackingId = trackingId?.trim().toUpperCase();

      if (!trackingId) {
        // Check if request is AJAX
        if (req.xhr || req.headers.accept?.includes("application/json")) {
          return res.status(400).json({
            success: false,
            error: "Tracking ID is required.",
            trackingId: "",
          });
        }

        return res.render("pages/track-form", {
          title: "Track Delivery - ExpressLog",
          page: "tracking",
          error: "Tracking ID is required.",
          trackingId: "",
        });
      }

      // Validate format - UPDATED for new format: DEL-XXXXXXXX-XXXX
      const trackingRegex = /^DEL-\d{8}-[A-Z0-9]{4}$/;
      if (!trackingRegex.test(trackingId)) {
        const errorMsg =
          "Invalid tracking ID format. Use DEL-XXXXXXXX-XXXX (e.g., DEL-51434020-X3RY).";

        if (req.xhr || req.headers.accept?.includes("application/json")) {
          return res.status(400).json({
            success: false,
            error: errorMsg,
            trackingId,
          });
        }

        return res.render("pages/track-form", {
          title: "Track Delivery - ExpressLog",
          page: "tracking",
          error: errorMsg,
          trackingId,
        });
      }

      // Verify existence
      const delivery = await Delivery.findOne({ trackingId });
      if (!delivery) {
        const errorMsg = "Tracking ID not found. Please verify and try again.";

        if (req.xhr || req.headers.accept?.includes("application/json")) {
          return res.status(404).json({
            success: false,
            error: errorMsg,
            trackingId,
          });
        }

        return res.render("pages/track-form", {
          title: "Track Delivery - ExpressLog",
          page: "tracking",
          error: errorMsg,
          trackingId,
        });
      }

      // Check delivery status for possible issues
      if (delivery.status === "cancelled" || delivery.status === "lost") {
        const statusMsg =
          delivery.status === "cancelled"
            ? "This shipment has been cancelled."
            : "This shipment has been marked as lost.";

        if (req.xhr || req.headers.accept?.includes("application/json")) {
          return res.status(200).json({
            success: true,
            redirect: `/delivery/track/results?trackingId=${encodeURIComponent(
              trackingId
            )}`,
            warning: statusMsg,
          });
        }
      }

      // Success response
      const redirectUrl = `/delivery/track/results?trackingId=${encodeURIComponent(
        trackingId
      )}`;

      if (req.xhr || req.headers.accept?.includes("application/json")) {
        return res.json({
          success: true,
          redirect: redirectUrl,
          deliveryId: delivery._id,
          status: delivery.status,
          estimatedDelivery: delivery.estimatedDelivery,
        });
      }

      // Regular form submission - redirect
      return res.redirect(redirectUrl);
    } catch (error) {
      console.error("Tracking form error:", error);
      const errorMsg = "An internal error occurred. Please try again later.";

      if (req.xhr || req.headers.accept?.includes("application/json")) {
        return res.status(500).json({
          success: false,
          error: errorMsg,
          trackingId: "",
        });
      }

      return res.render("pages/track-form", {
        title: "Track Delivery - ExpressLog",
        page: "tracking",
        error: errorMsg,
        trackingId: "",
      });
    }
  }

  // GET /delivery/track/results?trackingId=XXX - Tracking results page
  async getTrackingResults(req, res) {
    try {
      let { trackingId } = req.query;
      trackingId = trackingId?.trim().toUpperCase();

      if (!trackingId) {
        return res.redirect("/track?error=Tracking ID is required");
      }

      // Fetch delivery with driver and warehouse details - UPDATED
      const delivery = await Delivery.findOne({ trackingId })
        .populate("driver", "name phone rating photo status")
        .populate("warehouse", "name code location address city state phone"); // Changed from vehicle to warehouse

      if (!delivery) {
        return res.redirect("/track?error=Tracking ID not found");
      }

      // Mapbox / route data
      const mapboxData = delivery.getMapboxData
        ? delivery.getMapboxData()
        : {
            points: {
              pickup: {
                coordinates: delivery.sender?.address?.coordinates
                  ?.coordinates || [-74.006, 40.7128],
              },
              delivery: {
                coordinates: delivery.receiver?.address?.coordinates
                  ?.coordinates || [-73.935, 40.7306],
              },
              current: {
                coordinates: delivery.trackingData?.currentLocation
                  ?.coordinates || [-73.985, 40.7589],
                progress: delivery.trackingData?.routeProgress || 50,
              },
            },
          };

      // Format status for UI
      const statusInfo = formatStatus(delivery.status);

      // Estimated delivery fallback
      const estimatedDelivery =
        delivery.estimatedDelivery || new Date(Date.now() + 2 * 60 * 60 * 1000);

      // Generate timeline events dynamically
      const timelineEvents = generateTimeline(delivery);

      // Weather data for current package location
      const weatherData = await getWeatherData(
        delivery.trackingData?.currentLocation?.coordinates?.[1] || 40.7589,
        delivery.trackingData?.currentLocation?.coordinates?.[0] || -73.985
      );

      // Traffic conditions, can be mocked or fetched via API
      const trafficConditions = getTrafficConditions();

      // Progress percentage based on status or route progress
      const progress = calculateProgress(
        delivery.status,
        delivery.trackingData?.routeProgress
      );

      // Convert delivery document to a plain JS object for template
      const packageData = delivery.toObject();

      // Ensure all template fields are set to avoid "undefined"
      packageData.trackingId = packageData.trackingId || trackingId;
      packageData.package = packageData.package || {};
      packageData.package.weight = packageData.package.weight || 0;
      packageData.package.dimensions = packageData.package.dimensions || {
        length: 0,
        width: 0,
        height: 0,
      };
      packageData.sender = packageData.sender || { address: { city: "N/A" } };
      packageData.receiver = packageData.receiver || {
        address: { city: "Loading..." },
      };
      packageData.driver = packageData.driver || { name: "N/A", phone: "N/A" };
      packageData.warehouse = packageData.warehouse || {
        // Changed from vehicle to warehouse
        name: "N/A",
        code: "N/A",
        location: { coordinates: [0, 0] },
      };
      packageData.trackingData = packageData.trackingData || {
        routeProgress: progress,
      };

      // Format warehouse address for display
      if (packageData.warehouse && packageData.warehouse.address) {
        packageData.warehouse.formattedAddress = [
          packageData.warehouse.address,
          packageData.warehouse.city,
          packageData.warehouse.state,
        ]
          .filter(Boolean)
          .join(", ");
      }

      // Render EJS with fully matched dynamic data
      return res.render("pages/tracking-results", {
        title: `Tracking #${trackingId} - ExpressLog`,
        page: "tracking-results",
        delivery: packageData,
        package: packageData,
        statusInfo,
        mapboxData,
        mapboxToken: process.env.MAPBOX_ACCESS_TOKEN,
        timelineEvents,
        estimatedDelivery,
        weatherData,
        trafficConditions,
        progress,
        currentTime: new Date(),
        success: req.query.success || null,
        error: req.query.error || null,
      });
    } catch (error) {
      console.error("Tracking results error:", error);
      return res.redirect("/track?error=Unable to load tracking information");
    }
  }

  // GET /live-map/:trackingId - Live map page (full screen)
  async getLiveMap(req, res) {
    try {
      const { trackingId } = req.params;

      const delivery = await Delivery.findOne({
        trackingId: trackingId.toUpperCase(),
      })
        .populate("driver", "name phone")
        .populate("warehouse", "name code location"); // Changed from vehicle to warehouse

      if (!delivery) {
        return res.redirect("/track?error=Tracking ID not found");
      }

      const mapboxData = delivery.getMapboxData
        ? delivery.getMapboxData()
        : {
            points: {
              pickup: {
                coordinates: delivery.sender?.address?.coordinates
                  ?.coordinates || [-74.006, 40.7128],
              },
              delivery: {
                coordinates: delivery.receiver?.address?.coordinates
                  ?.coordinates || [-73.935, 40.7306],
              },
              current: {
                coordinates: delivery.trackingData?.currentLocation
                  ?.coordinates || [-73.985, 40.7589],
              },
            },
          };

      res.render("pages/live-map", {
        title: `Live Map #${trackingId} - ExpressLog`,
        page: "live-map",
        delivery: delivery.toObject(),
        mapboxData,
        mapboxToken: process.env.MAPBOX_ACCESS_TOKEN,
        statusInfo: formatStatus(delivery.status),
      });
    } catch (error) {
      console.error("Live map error:", error);
      res.redirect(
        `/delivery/track/results?trackingId=${req.params.trackingId}&error=Cannot load live map`
      );
    }
  }

  // GET /track/reschedule/:trackingId - Reschedule delivery form
  async getRescheduleForm(req, res) {
    try {
      const { trackingId } = req.params;

      const delivery = await Delivery.findOne({
        trackingId: trackingId.toUpperCase(),
      });

      if (!delivery) {
        return res.redirect("/track?error=Delivery not found");
      }

      // Calculate min date (tomorrow)
      const minDate = new Date();
      minDate.setDate(minDate.getDate() + 1);

      res.render("pages/reschedule-form", {
        title: `Reschedule Delivery #${trackingId} - ExpressLog`,
        page: "reschedule",
        delivery: delivery.toObject(),
        trackingId: trackingId,
        minDate: minDate.toISOString().split("T")[0],
        error: req.query.error || null,
      });
    } catch (error) {
      console.error("Reschedule form error:", error);
      res.redirect(
        `/delivery/track/results?trackingId=${req.params.trackingId}&error=Cannot load reschedule form`
      );
    }
  }

  // POST /track/reschedule/:trackingId - Process reschedule
  async postReschedule(req, res) {
    try {
      const { trackingId } = req.params;
      const { newDate, reason } = req.body;

      const delivery = await Delivery.findOne({
        trackingId: trackingId.toUpperCase(),
      });

      if (!delivery) {
        return res.redirect(
          `/track/reschedule/${trackingId}?error=Delivery not found`
        );
      }

      // Validate date
      const selectedDate = new Date(newDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        return res.redirect(
          `/track/reschedule/${trackingId}?error=Cannot reschedule to past date`
        );
      }

      // Update estimated delivery
      delivery.estimatedDelivery = selectedDate;
      delivery.delayInfo = {
        reason: "rescheduled",
        description: reason || "Customer requested reschedule",
        estimatedDelay: 0,
        reportedAt: new Date(),
      };

      await delivery.save();

      // Emit real-time update
      if (global.io) {
        const mapboxData = delivery.getMapboxData
          ? delivery.getMapboxData()
          : {};
        global.io.to(`tracking_${trackingId}`).emit("delivery_updated", {
          type: "rescheduled",
          data: mapboxData,
          newETA: delivery.estimatedDelivery,
        });
      }

      res.redirect(
        `/delivery/track/results?trackingId=${trackingId}&success=Delivery rescheduled successfully`
      );
    } catch (error) {
      console.error("Reschedule error:", error);
      res.redirect(
        `/track/reschedule/${req.params.trackingId}?error=Failed to reschedule`
      );
    }
  }

  // GET /track/redirect/:trackingId - Redirect delivery form
  async getRedirectForm(req, res) {
    try {
      const { trackingId } = req.params;

      const delivery = await Delivery.findOne({
        trackingId: trackingId.toUpperCase(),
      });

      if (!delivery) {
        return res.redirect("/track?error=Delivery not found");
      }

      res.render("pages/redirect-form", {
        title: `Redirect Delivery #${trackingId} - ExpressLog`,
        page: "redirect",
        delivery: delivery.toObject(),
        trackingId: trackingId,
        error: req.query.error || null,
      });
    } catch (error) {
      console.error("Redirect form error:", error);
      res.redirect(
        `/delivery/track/results?trackingId=${req.params.trackingId}&error=Cannot load redirect form`
      );
    }
  }

  // POST /track/redirect/:trackingId - Process redirect
  async postRedirect(req, res) {
    try {
      const { trackingId } = req.params;
      const { newAddress, recipientName, recipientPhone, instructions } =
        req.body;

      const delivery = await Delivery.findOne({
        trackingId: trackingId.toUpperCase(),
      });

      if (!delivery) {
        return res.redirect(
          `/track/redirect/${trackingId}?error=Delivery not found`
        );
      }

      // Validate required fields
      if (!newAddress || newAddress.trim().length < 10) {
        return res.redirect(
          `/track/redirect/${trackingId}?error=Please enter a valid address (minimum 10 characters)`
        );
      }

      // Update receiver information
      delivery.receiver = {
        ...delivery.receiver,
        name: recipientName || delivery.receiver.name,
        phone: recipientPhone || delivery.receiver.phone,
        address: {
          ...delivery.receiver.address,
          street: newAddress.trim(),
          fullAddress: newAddress.trim(),
          geocoded: false, // Reset geocoding flag
        },
        deliveryInstructions:
          instructions || delivery.receiver.deliveryInstructions,
      };

      // Geocode new address (if method exists)
      let geocodeResult = { success: true };
      if (delivery.geocodeAddress) {
        geocodeResult = await delivery.geocodeAddress(newAddress, "receiver");
      }

      if (!geocodeResult.success) {
        console.warn(
          "Geocoding failed or not available, continuing without geocoding"
        );
      }

      // Get new route (if method exists)
      let routeResult = { success: true };
      if (delivery.getMapboxDirections) {
        routeResult = await delivery.getMapboxDirections();
      }

      await delivery.save();

      // Emit real-time update
      if (global.io) {
        const mapboxData = delivery.getMapboxData
          ? delivery.getMapboxData()
          : {};
        global.io.to(`tracking_${trackingId}`).emit("delivery_updated", {
          type: "redirected",
          data: mapboxData,
          newAddress: newAddress,
        });
      }

      res.redirect(
        `/delivery/track/results?trackingId=${trackingId}&success=Delivery redirected successfully`
      );
    } catch (error) {
      console.error("Redirect error:", error);
      res.redirect(
        `/track/redirect/${req.params.trackingId}?error=Failed to redirect delivery`
      );
    }
  }

  // GET /track/invoice/:trackingId - Get invoice
  async getInvoice(req, res) {
    try {
      const { trackingId } = req.params;

      const delivery = await Delivery.findOne({
        trackingId: trackingId.toUpperCase(),
      })
        .populate("driver", "name phone")
        .populate("warehouse", "name code"); // Changed from vehicle to warehouse

      if (!delivery) {
        return res.render("pages/error", {
          title: "Error - ExpressLog",
          error: "Delivery not found",
          message: "Cannot generate invoice for non-existent delivery",
        });
      }

      res.render("pages/invoice", {
        title: `Invoice #${trackingId} - ExpressLog`,
        page: "invoice",
        delivery: delivery.toObject(),

        company: {
          name: "ExpressLog Delivery Services",
          address: "123 Logistics Street, Suite 100",
          city: "New York, NY 10001",
          phone: "1-800-EXPRESS",
          email: "billing@expresslog.com",
        },
      });
    } catch (error) {
      console.error("Invoice error:", error);
      res.render("pages/error", {
        title: "Error - ExpressLog",
        error: "Invoice Generation Error",
        message: error.message,
      });
    }
  }

  // GET /driver/dashboard - Driver dashboard
  async getDriverDashboard(req, res) {
    try {
      // In production, this would be authenticated
      // For demo, use a sample driver ID
      const driverId = "65f4a1b2c8d9e0f1a2b3c4d5"; // Sample driver ID

      const driver = await Driver.findById(driverId);

      if (!driver) {
        // Create demo driver if not found
        const demoDriver = await this.createDemoDriver();
        return res.render("pages/driver/dashboard", {
          title: "Driver Dashboard - ExpressLog",
          page: "driver-dashboard",
          driver: demoDriver,
          deliveries: [],
          stats: this.getDemoStats(),
          mapboxToken: process.env.MAPBOX_ACCESS_TOKEN,
        });
      }

      // Get all active deliveries for this driver
      const deliveries = await Delivery.find({
        driver: driverId,
        status: { $in: ["in_transit", "pending"] },
      })
        .populate("warehouse", "name code") // Changed from vehicle to warehouse
        .sort({ estimatedDelivery: 1 })
        .limit(5);

      // Calculate stats
      const stats = await this.calculateDriverStats(driverId);

      res.render("pages/driver/dashboard", {
        title: "Driver Dashboard - ExpressLog",
        page: "driver-dashboard",
        driver: driver.toObject(),
        deliveries: deliveries.map((d) => d.toObject()),
        stats: stats,
        mapboxToken: process.env.MAPBOX_ACCESS_TOKEN,
      });
    } catch (error) {
      console.error("Driver dashboard error:", error);
      // Fallback to demo data
      res.render("pages/driver/dashboard", {
        title: "Driver Dashboard - ExpressLog",
        page: "driver-dashboard",
        driver: this.getDemoDriver(),
        deliveries: this.getDemoDeliveries(),
        stats: this.getDemoStats(),
        mapboxToken: process.env.MAPBOX_ACCESS_TOKEN,
      });
    }
  }

  // GET /track/update-contact/:trackingId - Update contact page
  async getUpdateContact(req, res) {
    try {
      const { trackingId } = req.params;

      const delivery = await Delivery.findOne({
        trackingId: trackingId.toUpperCase(),
      })
        .populate("driver", "name phone")
        .populate("warehouse", "name code"); // Changed from vehicle to warehouse

      if (!delivery) {
        return res.redirect("/track?error=Delivery not found");
      }

      res.render("pages/update-contact", {
        title: `Update Contact - ${trackingId}`,
        page: "update-contact",
        delivery: delivery.toObject(),
        trackingId: trackingId,
        error: req.query.error || null,
        success: req.query.success || null,
      });
    } catch (error) {
      console.error("Update contact error:", error);
      res.redirect(
        `/delivery/track/results?trackingId=${req.params.trackingId}`
      );
    }
  }

  // POST /track/update-contact/:trackingId - Update contact information
  async postUpdateContact(req, res) {
    try {
      const { trackingId } = req.params;
      const { name, phone, email, instructions } = req.body;

      const delivery = await Delivery.findOne({
        trackingId: trackingId.toUpperCase(),
      });

      if (!delivery) {
        return res.redirect(
          `/track/update-contact/${trackingId}?error=Delivery not found`
        );
      }

      // Update receiver information
      delivery.receiver = {
        ...delivery.receiver,
        name: name || delivery.receiver.name,
        phone: phone || delivery.receiver.phone,
        email: email || delivery.receiver.email,
        deliveryInstructions:
          instructions || delivery.receiver.deliveryInstructions,
      };

      await delivery.save();

      res.redirect(
        `/track/update-contact/${trackingId}?success=Contact information updated successfully`
      );
    } catch (error) {
      console.error("Update contact error:", error);
      res.redirect(
        `/track/update-contact/${req.params.trackingId}?error=Failed to update contact information`
      );
    }
  }

  // GET /track/support/:trackingId - Support/help page
  async getSupportPage(req, res) {
    try {
      const { trackingId } = req.params;

      const delivery = await Delivery.findOne({
        trackingId: trackingId.toUpperCase(),
      })
        .populate("driver", "name phone")
        .populate("warehouse", "name code"); // Changed from vehicle to warehouse

      res.render("pages/support", {
        title: `Support - ${trackingId}`,
        page: "support",
        delivery: delivery ? delivery.toObject() : null,
        trackingId: trackingId,
      });
    } catch (error) {
      console.error("Support page error:", error);
      res.render("pages/support", {
        title: "Support - ExpressLog",
        page: "support",
        delivery: null,
        trackingId: req.params.trackingId,
      });
    }
  }

  // POST /track/report-issue/:trackingId - Report an issue
  async postReportIssue(req, res) {
    try {
      const { trackingId } = req.params;
      const { issueType, description, contactEmail } = req.body;

      const delivery = await Delivery.findOne({
        trackingId: trackingId.toUpperCase(),
      });

      if (!delivery) {
        return res.redirect(
          `/track/support/${trackingId}?error=Delivery not found`
        );
      }

      // Add incident to delivery (if method exists)
      if (delivery.addIncident) {
        await delivery.addIncident({
          type: "other",
          description: `Customer reported issue: ${issueType} - ${description}`,
          severity: "medium",
          estimatedDelay: 30,
          address: delivery.receiver.address?.fullAddress || "Unknown",
        });
      }

      // Send notification (in production, this would send email)
      console.log(
        `Issue reported for ${trackingId}: ${issueType} - ${description}`
      );
      console.log(`Customer contact: ${contactEmail}`);

      res.redirect(
        `/delivery/track/results?trackingId=${trackingId}&success=Issue reported successfully. Our team will contact you shortly.`
      );
    } catch (error) {
      console.error("Report issue error:", error);
      res.redirect(
        `/track/support/${req.params.trackingId}?error=Failed to report issue`
      );
    }
  }

  // CLASS HELPER METHODS (for demo/fallback data)

  async calculateDriverStats(driverId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deliveries = await Delivery.find({
      driver: driverId,
      status: "delivered",
      actualDelivery: { $gte: today },
    });

    const totalDeliveries = await Delivery.countDocuments({ driver: driverId });
    const completedToday = deliveries.length;
    const onTimeDeliveries = deliveries.filter(
      (d) => d.actualDelivery <= d.estimatedDelivery
    ).length;

    return {
      totalDeliveries,
      completedToday,
      onTimeRate:
        totalDeliveries > 0
          ? `${Math.round((onTimeDeliveries / totalDeliveries) * 100)}%`
          : "100%",
      totalDistance: "1,245 km",
      averageRating: "4.8",
    };
  }

  getDemoDriver() {
    return {
      name: "Michael Rodriguez",
      phone: "+1 (555) 123-4567",
      email: "m.rodriguez@expresslog.com",
      licenseNumber: "DRV7890123",
      photo: null,
      rating: 4.8,
      currentLocation: {
        coordinates: [-74.006, 40.7128],
      },
      status: "on_delivery",
      stats: {
        totalDeliveries: 1245,
        onTimeDeliveries: 1201,
        totalDistance: 12450,
      },
    };
  }

  getDemoDeliveries() {
    return [
      {
        trackingId: "DEL-51434020-X3RY",
        status: "in_transit",
        receiver: {
          name: "John Smith",
          address: {
            street: "123 Main Street",
            city: "New York",
          },
        },
        estimatedDelivery: new Date(Date.now() + 2 * 60 * 60 * 1000),
        trackingData: {
          routeProgress: 65,
          currentLocation: {
            coordinates: [-74.0059, 40.7127],
          },
        },
        warehouse: {
          // Changed from vehicle to warehouse
          name: "Main Warehouse",
          code: "WH-001",
          location: {
            coordinates: [-74.0065, 40.7132],
          },
        },
      },
      {
        trackingId: "DEL-62389145-B8TZ",
        status: "pending",
        receiver: {
          name: "Sarah Johnson",
          address: {
            street: "456 Oak Avenue",
            city: "Brooklyn",
          },
        },
        estimatedDelivery: new Date(Date.now() + 4 * 60 * 60 * 1000),
        trackingData: {
          routeProgress: 0,
          currentLocation: {
            coordinates: [-74.0065, 40.7132],
          },
        },
        warehouse: {
          // Changed from vehicle to warehouse
          name: "Brooklyn Warehouse",
          code: "WH-002",
          location: {
            coordinates: [-73.989, 40.6782],
          },
        },
      },
    ];
  }

  getDemoStats() {
    return {
      totalDeliveries: 1245,
      completedToday: 8,
      onTimeRate: "96.5%",
      totalDistance: "1,245 km",
      averageRating: "4.8",
    };
  }

  async createDemoDriver() {
    try {
      const driver = new Driver({
        name: "Michael Rodriguez",
        phone: "+1 (555) 123-4567",
        email: "m.rodriguez@expresslog.com",
        licenseNumber: `DRV${Date.now().toString().slice(-8)}`,
        rating: 4.8,
        currentLocation: {
          type: "Point",
          coordinates: [-74.006, 40.7128],
        },
        status: "available",
        stats: {
          totalDeliveries: 1245,
          onTimeDeliveries: 1201,
          totalDistance: 12450,
          ratingCount: 245,
        },
      });

      await driver.save();
      return driver.toObject();
    } catch (error) {
      console.error("Create demo driver error:", error);
      return this.getDemoDriver();
    }
  }

  // GET /track/print/:trackingId - Print delivery receipt
  async getPrintReceipt(req, res) {
    try {
      const { trackingId } = req.params;

      const delivery = await Delivery.findOne({
        trackingId: trackingId.toUpperCase(),
      })
        .populate("driver", "name phone licenseNumber")
        .populate("warehouse", "name code address city state phone")
        .lean();

      if (!delivery) {
        req.flash("error", "Delivery not found");
        return res.redirect(`/delivery/track/results?trackingId=${trackingId}`);
      }

      // Calculate delivery cost
      const baseRate = 12.99;
      const weightMultiplier = delivery.package.weight > 5 ? 1.5 : 1;
      const valueMultiplier = delivery.package.value > 100 ? 1.2 : 1;
      const distanceMultiplier = 1.1;

      const subtotal =
        baseRate * weightMultiplier * valueMultiplier * distanceMultiplier;
      const tax = subtotal * 0.08;
      const total = subtotal + tax;

      // Format dates
      const formatDate = (date) => {
        if (!date) return "N/A";
        return new Date(date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      };

      // Generate invoice number
      const invoiceNumber = `INV-${delivery.trackingId}-${Date.now()
        .toString()
        .slice(-6)}`;

      // Format warehouse address
      let warehouseAddress = "";
      if (delivery.warehouse) {
        const parts = [
          delivery.warehouse.address,
          delivery.warehouse.city,
          delivery.warehouse.state,
        ].filter(Boolean);
        warehouseAddress = parts.join(", ");
      }

      // Format sender address
      const senderAddress = delivery.sender.address
        ? [
            delivery.sender.address.street,
            delivery.sender.address.city,
            delivery.sender.address.state,
            delivery.sender.address.postalCode,
          ]
            .filter(Boolean)
            .join(", ")
        : "N/A";

      // Format receiver address
      const receiverAddress = delivery.receiver.address
        ? [
            delivery.receiver.address.street,
            delivery.receiver.address.city,
            delivery.receiver.address.state,
            delivery.receiver.address.postalCode,
          ]
            .filter(Boolean)
            .join(", ")
        : "N/A";

      // Get status text
      const statusText =
        {
          pending: "Pending",
          in_transit: "In Transit",
          delayed: "Delayed",
          delivered: "Delivered",
          cancelled: "Cancelled",
        }[delivery.status] || delivery.status;

      // Get the base URL for QR code
      const baseUrl = `${req.protocol}://${req.get("host")}`;

      res.render("pages/print-receipt", {
        title: `Receipt #${delivery.trackingId}`,
        page: "print-receipt",
        delivery: {
          ...delivery,
          formattedSenderAddress: senderAddress,
          formattedReceiverAddress: receiverAddress,
          formattedWarehouseAddress: warehouseAddress,
          statusText: statusText,
        },
        invoice: {
          invoiceNumber,
          date: formatDate(new Date()),
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          total: total.toFixed(2),
          breakdown: [
            { description: "Base Delivery Fee", amount: baseRate.toFixed(2) },
            {
              description: "Weight Surcharge",
              amount: (baseRate * (weightMultiplier - 1)).toFixed(2),
            },
            {
              description: "Value Insurance",
              amount: (baseRate * (valueMultiplier - 1)).toFixed(2),
            },
            {
              description: "Distance Charge",
              amount: (baseRate * (distanceMultiplier - 1)).toFixed(2),
            },
          ],
        },
        formatDate,
        company: {
          name: "ExpressLog Delivery Services",
          address: "123 Logistics Street, Suite 100",
          city: "New York, NY 10001",
          phone: "1-800-EXPRESS",
          email: "billing@expresslog.com",
          website: "www.expresslog.com",
        },
        currentDate: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        baseUrl: baseUrl, // Pass base URL to template
        fullTrackingUrl: `${baseUrl}/delivery/track/results?trackingId=${delivery.trackingId}`, // Pass full tracking URL
      });
    } catch (error) {
      console.error("Print receipt error:", error);
      req.flash("error", "Error generating print receipt");
      res.redirect(
        `/delivery/track/results?trackingId=${req.params.trackingId}`
      );
    }
  }
}

module.exports = new TrackingController();
