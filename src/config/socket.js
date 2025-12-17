import { Server } from "socket.io";
import DeliverySocket from "../sockets/deliverySocket.js";
import TrackingSocket from "../sockets/trackingSocket.js";
import logger from "../utils/logger.js";

/**
 * Configure Socket.IO server with namespaces and authentication
 */
export const configureSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Initialize socket namespaces
  const deliveryNamespace = io.of("/delivery");
  const trackingNamespace = io.of("/tracking");
  const adminNamespace = io.of("/admin");

  // Initialize socket handlers
  new DeliverySocket(deliveryNamespace);
  new TrackingSocket(trackingNamespace);

  // Admin namespace
  adminNamespace.on("connection", (socket) => {
    logger.info("Admin connected", { socketId: socket.id });

    socket.join("admins");

    socket.on("request-dashboard-data", async () => {
      try {
        socket.emit("dashboard-data", {
          stats: await getDashboardStats(),
          recentActivity: [],
        });
      } catch (error) {
        logger.error("Failed to fetch dashboard data", {
          error: error.message,
        });
        socket.emit("error", { message: "Failed to load dashboard data" });
      }
    });

    socket.on("disconnect", () => {
      logger.info("Admin disconnected", { socketId: socket.id });
    });
  });

  // Global connection handling
  io.on("connection", (socket) => {
    logger.info("Global socket connection", { socketId: socket.id });

    socket.on("disconnect", (reason) => {
      logger.info("Global socket disconnected", {
        socketId: socket.id,
        reason,
      });
    });
  });

  logger.info("Socket.IO server configured successfully");
  return io;
};

async function getDashboardStats() {
  return {
    totalDeliveries: 0,
    inTransit: 0,
    delivered: 0,
    delayed: 0,
    activeDrivers: 0,
  };
}
