import logger from "../utils/logger.js";

/**
 * Tracking Socket Handler for public package tracking
 */
class TrackingSocket {
  constructor(namespace) {
    this.namespace = namespace;
    this.trackingSessions = new Map();

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.namespace.on("connection", (socket) => {
      logger.info("Tracking socket connected", { socketId: socket.id });

      this.setupTrackingEvents(socket);

      socket.on("disconnect", () => {
        this.handleDisconnect(socket);
      });
    });
  }

  setupTrackingEvents(socket) {
    socket.on("join-delivery", async (data) => {
      try {
        const { deliveryId, trackingCode } = data;

        // Join delivery room
        socket.join(`delivery:${deliveryId}`);

        // Store tracking session
        this.trackingSessions.set(socket.id, {
          deliveryId,
          trackingCode,
          joinedAt: new Date(),
        });

        // Send mock delivery data
        const deliveryData = {
          deliveryId,
          trackingCode,
          currentStatus: "in-transit",
          recipient: { name: "John Doe" },
          timeline: [
            {
              status: "created",
              description: "Delivery created",
              timestamp: new Date(),
            },
          ],
        };

        socket.emit("delivery-data", {
          delivery: deliveryData,
          locationHistory: [],
        });

        logger.info("Joined delivery tracking", { deliveryId, trackingCode });
      } catch (error) {
        logger.error("Failed to join delivery tracking", {
          error: error.message,
        });
        socket.emit("error", { message: "Failed to load delivery data" });
      }
    });

    socket.on("public-track", async (data) => {
      try {
        const { trackingCode } = data;

        // Mock delivery lookup
        const delivery = {
          deliveryId: "DLV-12345",
          trackingCode,
          currentStatus: "in-transit",
          recipient: { name: "John Doe" },
        };

        socket.join(`delivery:${delivery.deliveryId}`);

        this.trackingSessions.set(socket.id, {
          deliveryId: delivery.deliveryId,
          trackingCode,
          isPublic: true,
          joinedAt: new Date(),
        });

        const publicDeliveryData = this.sanitizeDeliveryForPublic(delivery);

        socket.emit("public-delivery-data", {
          delivery: publicDeliveryData,
          locationHistory: [],
          currentStatus: delivery.currentStatus,
        });

        logger.info("Public tracking started", { trackingCode });
      } catch (error) {
        logger.error("Failed public tracking", { error: error.message });
        socket.emit("tracking-error", { message: "Failed to track delivery" });
      }
    });
  }

  sanitizeDeliveryForPublic(delivery) {
    const publicDelivery = { ...delivery };

    if (publicDelivery.recipient) {
      publicDelivery.recipient = {
        name: publicDelivery.recipient.name,
        // Don't include sensitive info
      };
    }

    return publicDelivery;
  }

  handleDisconnect(socket) {
    const session = this.trackingSessions.get(socket.id);
    if (session) {
      this.trackingSessions.delete(socket.id);
      logger.info("Tracking session ended", { deliveryId: session.deliveryId });
    }
    logger.info("Tracking socket disconnected", { socketId: socket.id });
  }
}

// Export as default
export default TrackingSocket;
