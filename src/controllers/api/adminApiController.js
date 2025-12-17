import Delivery from "../../models/Delivery.js";
import User from "../../models/User.js";
import LocationLog from "../../models/LocationLog.js";
import Helpers from "../../utils/helpers.js";
import logger from "../../utils/logger.js";

export class AdminApiController {
  static async getDashboardStats(req, res) {
    try {
      const [
        totalDeliveries,
        inTransitDeliveries,
        delayedDeliveries,
        deliveredThisWeek,
        activeDrivers,
        breakdownsThisWeek,
      ] = await Promise.all([
        Delivery.countDocuments(),
        Delivery.countDocuments({ currentStatus: "in-transit" }),
        Delivery.countDocuments({ currentStatus: "delayed" }),
        Delivery.countDocuments({
          currentStatus: "delivered",
          updatedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        }),
        User.countDocuments({ role: "driver", isActive: true }),
        Delivery.countDocuments({
          "breakdowns.timestamp": {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        }),
      ]);

      // Weekly delivery trends
      const weeklyTrends = await Delivery.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
      ]);

      res.json({
        success: true,
        stats: {
          totalDeliveries,
          inTransitDeliveries,
          delayedDeliveries,
          deliveredThisWeek,
          activeDrivers,
          breakdownsThisWeek,
        },
        weeklyTrends,
      });
    } catch (error) {
      logger.error("API Get dashboard stats error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch dashboard statistics",
      });
    }
  }

  static async exportDeliveries(req, res) {
    try {
      const { startDate, endDate, status } = req.query;

      const filter = {};
      if (startDate && endDate) {
        filter.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }
      if (status && status !== "all") {
        filter.currentStatus = status;
      }

      const deliveries = await Delivery.find(filter)
        .populate("driver", "username profile")
        .populate("createdBy", "username profile")
        .sort({ createdAt: -1 })
        .lean();

      const csvData = deliveries.map((delivery) => ({
        "Delivery ID": delivery.deliveryId,
        "Tracking Code": delivery.trackingCode,
        "Recipient Name": delivery.recipient.name,
        "Recipient Email": delivery.recipient.email,
        "Delivery Address": `${delivery.recipient.address.street}, ${delivery.recipient.address.city}`,
        Status: delivery.currentStatus,
        "Estimated Delivery": delivery.estimatedDelivery,
        "Actual Delivery": delivery.actualDelivery || "N/A",
        Driver: delivery.driver ? delivery.driver.username : "Unassigned",
        "Created By": delivery.createdBy.username,
        "Created At": delivery.createdAt,
      }));

      const csv = Helpers.generateCsv(csvData);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=deliveries-export.csv"
      );
      res.send(csv);
    } catch (error) {
      logger.error("API Export deliveries error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to export deliveries",
      });
    }
  }

  static async bulkUpdateStatus(req, res) {
    try {
      const { deliveryIds, status, description } = req.body;

      const result = await Delivery.updateMany(
        { deliveryId: { $in: deliveryIds } },
        {
          $set: { currentStatus: status },
          $push: {
            timeline: {
              status,
              description: description || `Bulk status update to ${status}`,
              timestamp: new Date(),
            },
          },
        }
      );

      res.json({
        success: true,
        message: `Updated ${result.modifiedCount} deliveries to ${status}`,
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      logger.error("API Bulk update status error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to bulk update delivery status",
      });
    }
  }

  static async getDrivers(req, res) {
    try {
      const drivers = await User.find({ role: "driver" })
        .select("username email profile isActive lastLogin createdAt")
        .sort({ createdAt: -1 })
        .lean();

      // Get driver statistics
      const driverStats = await Delivery.aggregate([
        {
          $match: { driver: { $exists: true } },
        },
        {
          $group: {
            _id: "$driver",
            totalDeliveries: { $sum: 1 },
            completedDeliveries: {
              $sum: { $cond: [{ $eq: ["$currentStatus", "delivered"] }, 1, 0] },
            },
            averageDeliveryTime: { $avg: "$actualDelivery" },
          },
        },
      ]);

      const driversWithStats = drivers.map((driver) => {
        const stats = driverStats.find(
          (stat) => stat._id.toString() === driver._id.toString()
        );
        return {
          ...driver,
          stats: stats || {
            totalDeliveries: 0,
            completedDeliveries: 0,
            averageDeliveryTime: null,
          },
        };
      });

      res.json({
        success: true,
        drivers: driversWithStats,
      });
    } catch (error) {
      logger.error("API Get drivers error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch drivers",
      });
    }
  }

  static async createDriver(req, res) {
    try {
      const { username, email, password, firstName, lastName, phone } =
        req.body;

      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: "User with this email or username already exists",
        });
      }

      const driver = new User({
        username,
        email,
        password,
        role: "driver",
        profile: {
          firstName,
          lastName,
          phone,
        },
      });

      await driver.save();

      res.status(201).json({
        success: true,
        message: "Driver created successfully",
        driver: driver.toJSON(),
      });
    } catch (error) {
      logger.error("API Create driver error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create driver",
      });
    }
  }

  static async updateDriver(req, res) {
    try {
      const { driverId } = req.params;
      const updateData = req.body;

      const driver = await User.findOneAndUpdate(
        { _id: driverId, role: "driver" },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!driver) {
        return res.status(404).json({
          success: false,
          error: "Driver not found",
        });
      }

      res.json({
        success: true,
        message: "Driver updated successfully",
        driver: driver.toJSON(),
      });
    } catch (error) {
      logger.error("API Update driver error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update driver",
      });
    }
  }

  static async deleteDriver(req, res) {
    try {
      const { driverId } = req.params;

      // Check if driver has active deliveries
      const activeDeliveries = await Delivery.countDocuments({
        driver: driverId,
        currentStatus: { $in: ["in-transit", "out-for-delivery"] },
      });

      if (activeDeliveries > 0) {
        return res.status(400).json({
          success: false,
          error: "Cannot delete driver with active deliveries",
        });
      }

      const driver = await User.findOneAndDelete({
        _id: driverId,
        role: "driver",
      });

      if (!driver) {
        return res.status(404).json({
          success: false,
          error: "Driver not found",
        });
      }

      res.json({
        success: true,
        message: "Driver deleted successfully",
      });
    } catch (error) {
      logger.error("API Delete driver error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete driver",
      });
    }
  }

  static async getDeliveryMetrics(req, res) {
    try {
      const { days = 30 } = req.query;

      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Delivery status distribution
      const statusDistribution = await Delivery.aggregate([
        {
          $match: { createdAt: { $gte: startDate } },
        },
        {
          $group: {
            _id: "$currentStatus",
            count: { $sum: 1 },
          },
        },
      ]);

      // Daily delivery counts
      const dailyDeliveries = await Delivery.aggregate([
        {
          $match: { createdAt: { $gte: startDate } },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Average delivery time
      const deliveryTimeStats = await Delivery.aggregate([
        {
          $match: {
            currentStatus: "delivered",
            actualDelivery: { $exists: true },
            createdAt: { $gte: startDate },
          },
        },
        {
          $project: {
            deliveryTime: {
              $divide: [
                { $subtract: ["$actualDelivery", "$createdAt"] },
                1000 * 60 * 60, // Convert to hours
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            averageTime: { $avg: "$deliveryTime" },
            minTime: { $min: "$deliveryTime" },
            maxTime: { $max: "$deliveryTime" },
          },
        },
      ]);

      res.json({
        success: true,
        metrics: {
          statusDistribution,
          dailyDeliveries,
          deliveryTime: deliveryTimeStats[0] || {
            averageTime: 0,
            minTime: 0,
            maxTime: 0,
          },
        },
      });
    } catch (error) {
      logger.error("API Get delivery metrics error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch delivery metrics",
      });
    }
  }

  static async getBreakdownReports(req, res) {
    try {
      const { days = 30, severity } = req.query;

      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const matchStage = {
        "breakdowns.timestamp": { $gte: startDate },
      };

      if (severity) {
        matchStage["breakdowns.severity"] = severity;
      }

      const breakdowns = await Delivery.aggregate([
        {
          $match: matchStage,
        },
        { $unwind: "$breakdowns" },
        {
          $match: {
            "breakdowns.timestamp": { $gte: startDate },
          },
        },
        {
          $project: {
            deliveryId: 1,
            trackingCode: 1,
            recipient: 1,
            breakdown: "$breakdowns",
          },
        },
        { $sort: { "breakdown.timestamp": -1 } },
      ]);

      // Breakdown statistics
      const breakdownStats = await Delivery.aggregate([
        {
          $match: {
            "breakdowns.timestamp": { $gte: startDate },
          },
        },
        { $unwind: "$breakdowns" },
        {
          $match: {
            "breakdowns.timestamp": { $gte: startDate },
          },
        },
        {
          $group: {
            _id: "$breakdowns.type",
            count: { $sum: 1 },
            averageResolutionTime: {
              $avg: {
                $cond: [
                  "$breakdowns.resolved",
                  {
                    $divide: [
                      {
                        $subtract: [
                          "$breakdowns.resolvedAt",
                          "$breakdowns.timestamp",
                        ],
                      },
                      1000 * 60 * 60, // Convert to hours
                    ],
                  },
                  null,
                ],
              },
            },
          },
        },
      ]);

      res.json({
        success: true,
        breakdowns,
        statistics: breakdownStats,
      });
    } catch (error) {
      logger.error("API Get breakdown reports error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch breakdown reports",
      });
    }
  }

  static async getSettings(req, res) {
    try {
      // In a real application, you'd fetch these from a settings collection
      const settings = {
        notifications: {
          email: true,
          push: true,
          breakdownAlerts: true,
          statusUpdates: true,
        },
        delivery: {
          defaultEstimatedDays: 3,
          autoAssignDrivers: false,
          requireSignature: true,
        },
        map: {
          defaultZoom: 12,
          refreshInterval: 30,
          showTraffic: true,
        },
      };

      res.json({
        success: true,
        settings,
      });
    } catch (error) {
      logger.error("API Get settings error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch settings",
      });
    }
  }

  static async updateSettings(req, res) {
    try {
      const { settings } = req.body;

      // In a real application, you'd save these to a settings collection
      // For now, we'll just return success

      res.json({
        success: true,
        message: "Settings updated successfully",
        settings,
      });
    } catch (error) {
      logger.error("API Update settings error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update settings",
      });
    }
  }
}
