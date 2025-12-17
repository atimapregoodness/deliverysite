import logger from "../utils/logger.js";

/**
 * Service for managing Socket.IO operations and real-time communications
 */
export class SocketService {
  constructor(io) {
    this.io = io;
  }

  /**
   * Broadcast delivery status update to all interested clients
   */
  async broadcastDeliveryStatusUpdate(deliveryId, updateData) {
    try {
      const { oldStatus, newStatus, updatedBy, description } = updateData;

      // Broadcast to delivery tracking namespace
      this.io
        .of("/tracking")
        .to(`delivery:${deliveryId}`)
        .emit("delivery-status-updated", {
          deliveryId,
          oldStatus,
          newStatus,
          updatedBy,
          description,
          timestamp: new Date(),
        });

      // Notify admin namespace
      this.io.of("/admin").to("admins").emit("delivery-status-changed", {
        deliveryId,
        oldStatus,
        newStatus,
        updatedBy,
        timestamp: new Date(),
      });

      logger.info("Broadcasted delivery status update", {
        deliveryId,
        oldStatus,
        newStatus,
        updatedBy,
      });
    } catch (error) {
      logger.error("Failed to broadcast delivery status update", {
        deliveryId,
        error: error.message,
      });
    }
  }

  /**
   * Broadcast location update to tracking clients
   */
  async broadcastLocationUpdate(deliveryId, locationData) {
    try {
      const { coordinates, address, speed, batteryLevel, driver } =
        locationData;

      this.io
        .of("/tracking")
        .to(`delivery:${deliveryId}`)
        .emit("location-updated", {
          deliveryId,
          coordinates,
          address,
          speed,
          batteryLevel,
          driver,
          timestamp: new Date(),
        });

      // Update admin dashboard with driver location
      this.io.of("/admin").to("admins").emit("driver-location-update", {
        deliveryId,
        driverId: driver.id,
        driverName: driver.username,
        coordinates,
        speed,
        batteryLevel,
        timestamp: new Date(),
      });

      logger.debug("Broadcasted location update", {
        deliveryId,
        coordinates,
        driver: driver.username,
      });
    } catch (error) {
      logger.error("Failed to broadcast location update", {
        deliveryId,
        error: error.message,
      });
    }
  }

  /**
   * Broadcast breakdown alert
   */
  async broadcastBreakdownAlert(deliveryId, breakdownData) {
    try {
      const { breakdown, reportedBy } = breakdownData;

      // Broadcast to tracking clients
      this.io
        .of("/tracking")
        .to(`delivery:${deliveryId}`)
        .emit("breakdown-reported", {
          deliveryId,
          breakdown,
          reportedBy,
          timestamp: new Date(),
        });

      // High-priority alert to admin
      this.io
        .of("/admin")
        .to("admins")
        .emit("breakdown-alert", {
          deliveryId,
          breakdown,
          reportedBy,
          timestamp: new Date(),
          urgency: breakdown.severity === "critical" ? "high" : "medium",
        });

      logger.warn("Broadcasted breakdown alert", {
        deliveryId,
        breakdownType: breakdown.type,
        severity: breakdown.severity,
        reportedBy,
      });
    } catch (error) {
      logger.error("Failed to broadcast breakdown alert", {
        deliveryId,
        error: error.message,
      });
    }
  }

  /**
   * Notify driver about new assignment
   */
  async notifyDriverAssignment(driverId, delivery) {
    try {
      this.io
        .of("/delivery")
        .to(`driver:${driverId}`)
        .emit("delivery-assigned", {
          delivery,
          assignedAt: new Date(),
          message: `New delivery assigned: ${delivery.trackingCode}`,
        });

      logger.info("Notified driver about assignment", {
        driverId,
        deliveryId: delivery.deliveryId,
        trackingCode: delivery.trackingCode,
      });
    } catch (error) {
      logger.error("Failed to notify driver about assignment", {
        driverId,
        deliveryId: delivery.deliveryId,
        error: error.message,
      });
    }
  }

  /**
   * Broadcast delivery completion
   */
  async broadcastDeliveryCompletion(deliveryId, completionData) {
    try {
      const { deliveredBy, signature, timestamp } = completionData;

      this.io
        .of("/tracking")
        .to(`delivery:${deliveryId}`)
        .emit("delivery-completed", {
          deliveryId,
          deliveredBy,
          signature,
          timestamp,
        });

      this.io.of("/admin").to("admins").emit("delivery-completed", {
        deliveryId,
        deliveredBy,
        timestamp,
      });

      logger.info("Broadcasted delivery completion", {
        deliveryId,
        deliveredBy,
      });
    } catch (error) {
      logger.error("Failed to broadcast delivery completion", {
        deliveryId,
        error: error.message,
      });
    }
  }

  /**
   * Get connected drivers count
   */
  getConnectedDriversCount() {
    try {
      const deliveryNamespace = this.io.of("/delivery");
      let driverCount = 0;

      deliveryNamespace.sockets.forEach((socket) => {
        if (socket.user && socket.user.role === "driver") {
          driverCount++;
        }
      });

      return driverCount;
    } catch (error) {
      logger.error("Failed to get connected drivers count", {
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Get active tracking sessions count
   */
  getActiveTrackingSessionsCount() {
    try {
      const trackingNamespace = this.io.of("/tracking");
      return trackingNamespace.sockets.size;
    } catch (error) {
      logger.error("Failed to get active tracking sessions count", {
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Send real-time notification to user
   */
  async sendUserNotification(userId, notification) {
    try {
      this.io.emit(`user:${userId}`, {
        type: "notification",
        notification,
        timestamp: new Date(),
      });

      logger.debug("Sent user notification", {
        userId,
        notificationType: notification.type,
      });
    } catch (error) {
      logger.error("Failed to send user notification", {
        userId,
        error: error.message,
      });
    }
  }

  /**
   * Broadcast system announcement
   */
  async broadcastSystemAnnouncement(announcement) {
    try {
      const { title, message, type, priority } = announcement;

      this.io.emit("system-announcement", {
        title,
        message,
        type,
        priority,
        timestamp: new Date(),
      });

      logger.info("Broadcasted system announcement", {
        title,
        type,
        priority,
      });
    } catch (error) {
      logger.error("Failed to broadcast system announcement", {
        error: error.message,
      });
    }
  }

  /**
   * Force disconnect socket by user ID
   */
  async disconnectUserSocket(userId) {
    try {
      let disconnectedCount = 0;

      // Check all namespaces for user sockets
      this.io._nsps.forEach((namespace) => {
        namespace.sockets.forEach((socket) => {
          if (socket.userId === userId) {
            socket.disconnect(true);
            disconnectedCount++;
          }
        });
      });

      logger.info("Disconnected user sockets", {
        userId,
        disconnectedCount,
      });

      return disconnectedCount;
    } catch (error) {
      logger.error("Failed to disconnect user sockets", {
        userId,
        error: error.message,
      });
      return 0;
    }
  }
}

export default SocketService;
