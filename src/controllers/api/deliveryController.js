import Delivery from "../../models/Delivery.js";
import User from "../../models/User.js";
import { DeliveryService } from "../../services/deliveryService.js";
import { NotificationService } from "../../services/notificationService.js";
import Validators from "../../utils/validators.js";
import logger from "../../utils/logger.js";

export class DeliveryController {
  static async trackDelivery(req, res) {
    try {
      const { trackingCode } = req.params;

      const delivery = await DeliveryService.getDeliveryWithTracking(
        trackingCode
      );
      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      res.json({
        success: true,
        delivery,
      });
    } catch (error) {
      logger.error("API Track delivery error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to track delivery",
      });
    }
  }

  static async getDeliveries(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status;
      const driverId = req.query.driverId;

      const filter = {};
      if (status && status !== "all") {
        filter.currentStatus = status;
      }
      if (driverId) {
        filter.driver = driverId;
      }

      const deliveries = await Delivery.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .populate("driver", "username profile")
        .populate("createdBy", "username profile")
        .lean();

      const total = await Delivery.countDocuments(filter);

      res.json({
        success: true,
        deliveries,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error("API Get deliveries error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch deliveries",
      });
    }
  }

  static async getDelivery(req, res) {
    try {
      const { deliveryId } = req.params;

      const delivery = await Delivery.findOne({ deliveryId })
        .populate("driver", "username profile")
        .populate("createdBy", "username profile")
        .lean();

      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      res.json({
        success: true,
        delivery,
      });
    } catch (error) {
      logger.error("API Get delivery error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch delivery",
      });
    }
  }

  static async createDelivery(req, res) {
    try {
      const { error } = Validators.deliveryCreation(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
      }

      const delivery = await DeliveryService.createDelivery(
        req.body,
        req.user._id
      );

      await NotificationService.sendDeliveryUpdate(delivery, "created");

      res.status(201).json({
        success: true,
        message: "Delivery created successfully",
        delivery,
      });
    } catch (error) {
      logger.error("API Create delivery error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create delivery",
      });
    }
  }

  static async updateDelivery(req, res) {
    try {
      const { deliveryId } = req.params;

      const delivery = await Delivery.findOneAndUpdate(
        { deliveryId },
        { $set: req.body },
        { new: true, runValidators: true }
      );

      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      res.json({
        success: true,
        message: "Delivery updated successfully",
        delivery,
      });
    } catch (error) {
      logger.error("API Update delivery error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update delivery",
      });
    }
  }

  static async updateStatus(req, res) {
    try {
      const { deliveryId } = req.params;
      const { status, description } = req.body;

      const delivery = await Delivery.findOne({ deliveryId });
      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      delivery.currentStatus = status;
      delivery.timeline.push({
        status,
        description: description || `Status updated to ${status}`,
        timestamp: new Date(),
      });

      await delivery.save();

      await NotificationService.sendDeliveryUpdate(delivery, "status-updated");

      res.json({
        success: true,
        message: "Delivery status updated successfully",
        delivery,
      });
    } catch (error) {
      logger.error("API Update status error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update delivery status",
      });
    }
  }

  static async assignDriver(req, res) {
    try {
      const { deliveryId } = req.params;
      const { driverId } = req.body;

      const delivery = await Delivery.findOne({ deliveryId });
      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Delivery not found",
        });
      }

      const driver = await User.findOne({ _id: driverId, role: "driver" });
      if (!driver) {
        return res.status(404).json({
          success: false,
          error: "Driver not found",
        });
      }

      delivery.driver = driverId;
      delivery.timeline.push({
        status: "processing",
        description: `Assigned to driver: ${driver.username}`,
        timestamp: new Date(),
      });

      await delivery.save();

      res.json({
        success: true,
        message: "Driver assigned successfully",
        delivery,
      });
    } catch (error) {
      logger.error("API Assign driver error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to assign driver",
      });
    }
  }

  static async getAssignedDeliveries(req, res) {
    try {
      const deliveries = await Delivery.find({ driver: req.user._id })
        .sort({ createdAt: -1 })
        .populate("createdBy", "username profile")
        .lean();

      res.json({
        success: true,
        deliveries,
      });
    } catch (error) {
      logger.error("API Get assigned deliveries error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch assigned deliveries",
      });
    }
  }

  static async updateLocation(req, res) {
    try {
      const { deliveryId } = req.params;
      const { lat, lng, address, speed, batteryLevel } = req.body;

      const result = await DeliveryService.updateLocation(
        deliveryId,
        { lat, lng },
        { address, speed, batteryLevel }
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

  static async reportBreakdown(req, res) {
    try {
      const { deliveryId } = req.params;
      const breakdownData = req.body;

      const delivery = await DeliveryService.reportBreakdown(
        deliveryId,
        breakdownData
      );

      await NotificationService.sendBreakdownAlert(delivery, breakdownData);

      res.json({
        success: true,
        message: "Breakdown reported successfully",
        delivery,
      });
    } catch (error) {
      logger.error("API Report breakdown error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to report breakdown",
      });
    }
  }

  static async resolveBreakdown(req, res) {
    try {
      const { breakdownId } = req.params;

      const delivery = await Delivery.findOneAndUpdate(
        { "breakdowns._id": breakdownId },
        {
          $set: {
            "breakdowns.$.resolved": true,
            "breakdowns.$.resolvedAt": new Date(),
          },
        },
        { new: true }
      );

      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: "Breakdown not found",
        });
      }

      res.json({
        success: true,
        message: "Breakdown resolved successfully",
        delivery,
      });
    } catch (error) {
      logger.error("API Resolve breakdown error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to resolve breakdown",
      });
    }
  }
}
