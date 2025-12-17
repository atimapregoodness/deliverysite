import { addEmailJob } from "../workers/emailQueue.js";
import logger from "../utils/logger.js";

export class NotificationService {
  static async sendDeliveryUpdate(delivery, updateType) {
    try {
      await addEmailJob(
        "delivery-update",
        {
          delivery,
          updateType,
        },
        {
          delay: 1000, // 1 second delay
          priority: 3,
        }
      );

      logger.info(
        `Delivery update notification queued for ${delivery.trackingCode}`
      );
    } catch (error) {
      logger.error("Failed to queue delivery update notification:", error);
    }
  }

  static async sendBreakdownAlert(delivery, breakdown) {
    try {
      await addEmailJob(
        "breakdown-alert",
        {
          delivery,
          breakdown,
        },
        {
          priority: 1, // High priority for breakdowns
        }
      );

      logger.info(`Breakdown alert queued for ${delivery.trackingCode}`);
    } catch (error) {
      logger.error("Failed to queue breakdown alert:", error);
    }
  }

  static async sendStatusNotification(delivery, oldStatus, newStatus) {
    try {
      await addEmailJob(
        "status-notification",
        {
          delivery,
          oldStatus,
          newStatus,
        },
        {
          priority: 2,
        }
      );

      logger.info(`Status notification queued for ${delivery.trackingCode}`);
    } catch (error) {
      logger.error("Failed to queue status notification:", error);
    }
  }

  static async sendWelcomeEmail(user) {
    try {
      await addEmailJob("welcome-email", {
        user,
      });

      logger.info(`Welcome email queued for ${user.email}`);
    } catch (error) {
      logger.error("Failed to queue welcome email:", error);
    }
  }

  // Push notification method (for future mobile app integration)
  static async sendPushNotification(userId, title, message, data = {}) {
    try {
      // Implementation for push notifications (Firebase, OneSignal, etc.)
      logger.info(`Push notification sent to user ${userId}: ${title}`);
    } catch (error) {
      logger.error("Failed to send push notification:", error);
    }
  }

  // SMS notification method
  static async sendSMSNotification(phoneNumber, message) {
    try {
      // Implementation for SMS notifications (Twilio, etc.)
      logger.info(`SMS sent to ${phoneNumber}: ${message}`);
    } catch (error) {
      logger.error("Failed to send SMS:", error);
    }
  }
}
