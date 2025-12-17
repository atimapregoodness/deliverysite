import LocationLog from "../../models/LocationLog.js";
import Delivery from "../../models/Delivery.js";
import { DeliveryService } from "../../services/deliveryService.js";
import logger from "../../utils/logger.js";

export class LocationController {
  static async getDeliveryLocations(req, res) {
    try {
      const { trackingCode } = req.params;

      const delivery = await Delivery.findOne({ trackingCode });
      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      const locationLogs = await LocationLog.find({
        delivery: delivery._id,
      })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();

      res.json({
        success: true,
        locations: locationLogs,
      });
    } catch (error) {
      logger.error("API Get delivery locations error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch delivery locations",
      });
    }
  }

  static async getLocationHistory(req, res) {
    try {
      const { deliveryId } = req.params;
      const { startDate, endDate, limit = 100 } = req.query;

      const delivery = await Delivery.findOne({ deliveryId });
      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      const filter = { delivery: delivery._id };

      if (startDate && endDate) {
        filter.timestamp = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      const locationLogs = await LocationLog.find(filter)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .lean();

      res.json({
        success: true,
        locations: locationLogs,
      });
    } catch (error) {
      logger.error("API Get location history error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch location history",
      });
    }
  }

  static async updateLocation(req, res) {
    try {
      const { deliveryId } = req.params;
      const { lat, lng, address, speed, batteryLevel, signalStrength } =
        req.body;

      const result = await DeliveryService.updateLocation(
        deliveryId,
        { lat, lng },
        { address, speed, batteryLevel, signalStrength }
      );

      res.json({
        success: true,
        message: "Location updated successfully",
        location: result.locationLog,
      });
    } catch (error) {
      logger.error("API Update location error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update location",
      });
    }
  }

  static async getLiveDrivers(req, res) {
    try {
      // Get drivers with active deliveries and recent location updates
      const activeDeliveries = await Delivery.find({
        currentStatus: { $in: ["in-transit", "out-for-delivery"] },
        driver: { $exists: true },
      })
        .populate("driver", "username profile")
        .lean();

      const driverLocations = [];

      for (const delivery of activeDeliveries) {
        const latestLocation = await LocationLog.findOne({
          delivery: delivery._id,
        })
          .sort({ timestamp: -1 })
          .lean();

        if (latestLocation && delivery.driver) {
          driverLocations.push({
            driver: delivery.driver,
            delivery: {
              deliveryId: delivery.deliveryId,
              trackingCode: delivery.trackingCode,
              currentStatus: delivery.currentStatus,
            },
            location: latestLocation.coordinates,
            timestamp: latestLocation.timestamp,
            speed: latestLocation.speed,
            batteryLevel: latestLocation.batteryLevel,
          });
        }
      }

      res.json({
        success: true,
        drivers: driverLocations,
      });
    } catch (error) {
      logger.error("API Get live drivers error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch live drivers",
      });
    }
  }
}
