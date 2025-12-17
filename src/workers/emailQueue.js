import { Worker, Queue } from "bullmq";
import EmailService from "../services/emailService.js";
import logger from "../utils/logger.js";
import config from "../config/environment.js";

// Create queue
export const emailQueue = new Queue("email", {
  connection: config.REDIS,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 1000,
  },
});

// Create worker
const emailWorker = new Worker(
  "email",
  async (job) => {
    try {
      const { type, data } = job.data;

      switch (type) {
        case "delivery-update":
          await EmailService.sendDeliveryUpdate(data.delivery, data.updateType);
          break;

        case "breakdown-alert":
          await EmailService.sendBreakdownAlert(data.delivery, data.breakdown);
          break;

        case "status-notification":
          await EmailService.sendStatusNotification(
            data.delivery,
            data.oldStatus,
            data.newStatus
          );
          break;

        case "welcome-email":
          await EmailService.sendWelcomeEmail(data.user);
          break;

        default:
          logger.warn(`Unknown email type: ${type}`);
      }

      logger.info(`Email job ${job.id} completed successfully`);
      return { success: true };
    } catch (error) {
      logger.error(`Email job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection: config.REDIS,
    concurrency: 5,
  }
);

// Worker event listeners
emailWorker.on("completed", (job) => {
  logger.info(`Email job ${job.id} completed`);
});

emailWorker.on("failed", (job, err) => {
  logger.error(`Email job ${job.id} failed:`, err);
});

emailWorker.on("error", (err) => {
  logger.error("Email worker error:", err);
});

// Utility function to add email jobs
export const addEmailJob = async (type, data, options = {}) => {
  return await emailQueue.add(type, { type, data }, options);
};

export default emailWorker;
