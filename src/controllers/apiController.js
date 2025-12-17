// controllers/apiController.js
const Delivery = require("../models/Delivery");
const Driver = require("../models/Driver");

class ApiController {
  // GET /api/delivery/:trackingId - Get delivery data
  async getDelivery(req, res) {
    try {
      const { trackingId } = req.params;

      const delivery = await Delivery.findOne({
        trackingId: trackingId.toUpperCase(),
      })
        .populate("driver")
        .populate("vehicle");

      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      res.json({
        success: true,
        data: delivery.getMapboxData(),
      });
    } catch (error) {
      console.error("Get delivery error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // GET /api/delivery/:trackingId/route - Get route data
  async getDeliveryRoute(req, res) {
    try {
      const { trackingId } = req.params;

      const delivery = await Delivery.findOne({
        trackingId: trackingId.toUpperCase(),
      });

      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      // Generate route if not exists
      if (!delivery.route || !delivery.route.geometry) {
        await delivery.getMapboxDirections();
      }

      res.json({
        success: true,
        route: delivery.route,
      });
    } catch (error) {
      console.error("Get route error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // GET /api/delivery/:trackingId/location - Get current location
  async getCurrentLocation(req, res) {
    try {
      const { trackingId } = req.params;

      const delivery = await Delivery.findOne({
        trackingId: trackingId.toUpperCase(),
      });

      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      res.json({
        success: true,
        location: delivery.trackingData.currentLocation.coordinates,
        progress: delivery.trackingData.routeProgress,
        speed: delivery.trackingData.speed,
        bearing: delivery.trackingData.bearing,
        lastUpdated: delivery.trackingData.lastUpdated,
      });
    } catch (error) {
      console.error("Get location error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST /api/delivery/:trackingId/location - Update location (for admin)
  async updateLocation(req, res) {
    try {
      const { trackingId } = req.params;
      const { longitude, latitude, progress } = req.body;

      const delivery = await Delivery.findOne({
        trackingId: trackingId.toUpperCase(),
      });

      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      await delivery.updatePosition(longitude, latitude, progress);

      // Emit real-time update
      if (global.io) {
        const mapboxData = delivery.getMapboxData();
        global.io
          .to(`tracking_${trackingId}`)
          .emit("delivery_updated", mapboxData);
      }

      res.json({
        success: true,
        message: "Location updated",
        location: [longitude, latitude],
        progress: delivery.trackingData.routeProgress,
      });
    } catch (error) {
      console.error("Update location error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST /api/delivery/:trackingId/incident - Report incident
  async reportIncident(req, res) {
    try {
      const { trackingId } = req.params;
      const { type, description, severity, estimatedDelay, address } = req.body;

      const delivery = await Delivery.findOne({
        trackingId: trackingId.toUpperCase(),
      });

      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      const incidentData = {
        type,
        description,
        severity: severity || "medium",
        estimatedDelay: estimatedDelay || 30,
        address,
      };

      await delivery.addIncident(incidentData);

      // Emit real-time update
      if (global.io) {
        const mapboxData = delivery.getMapboxData();
        global.io.to(`tracking_${trackingId}`).emit("delivery_updated", {
          type: "incident",
          data: mapboxData,
          incident: incidentData,
        });
      }

      res.json({
        success: true,
        message: "Incident reported",
        incident: incidentData,
        status: delivery.status,
      });
    } catch (error) {
      console.error("Report incident error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST /api/delivery/:trackingId/status - Update status
  async updateStatus(req, res) {
    try {
      const { trackingId } = req.params;
      const { status, proof } = req.body;

      const delivery = await Delivery.findOne({
        trackingId: trackingId.toUpperCase(),
      });

      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      if (status === "delivered") {
        await delivery.markAsDelivered(proof);
      } else {
        delivery.status = status;
        await delivery.save();
      }

      // Emit real-time update
      if (global.io) {
        const mapboxData = delivery.getMapboxData();
        global.io.to(`tracking_${trackingId}`).emit("delivery_updated", {
          type: "status_change",
          data: mapboxData,
          newStatus: status,
        });
      }

      res.json({
        success: true,
        message: "Status updated",
        status: delivery.status,
        actualDelivery: delivery.actualDelivery,
      });
    } catch (error) {
      console.error("Update status error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // GET /api/driver/:driverId/deliveries - Get driver deliveries
  async getDriverDeliveries(req, res) {
    try {
      const { driverId } = req.params;
      const { status, date } = req.query;

      const query = { driver: driverId };

      if (status) {
        query.status = status;
      }

      if (date) {
        query.estimatedDelivery = {
          $gte: new Date(date),
          $lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
        };
      }

      const deliveries = await Delivery.find(query)
        .sort({ estimatedDelivery: 1 })
        .populate("vehicle");

      res.json({
        success: true,
        count: deliveries.length,
        deliveries: deliveries.map((d) => d.getMapboxData()),
      });
    } catch (error) {
      console.error("Get driver deliveries error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ApiController();
