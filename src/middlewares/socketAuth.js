import jwt from "jsonwebtoken";
import User from "../models/User.js";
import logger from "../utils/logger.js";

/**
 * Socket.IO authentication middleware
 */
export const authenticateSocket = async (socket, next) => {
  try {
    // Get token from handshake auth or query string
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      // Allow anonymous connections for public tracking
      if (socket.handshake.query?.public === "true") {
        socket.user = { role: "public" };
        return next();
      }

      logger.securityEvent("socket-auth-failed", null, {
        socketId: socket.id,
        reason: "No token provided",
      });
      return next(new Error("Authentication required"));
    }

    // Verify JWT token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    );

    // Fetch user from database
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      logger.securityEvent("socket-auth-failed", null, {
        socketId: socket.id,
        reason: "User not found",
      });
      return next(new Error("User not found"));
    }

    // Attach user to socket
    socket.user = user;
    socket.userId = user._id;
    socket.userRole = user.role;

    logger.socketEvent("socket-authenticated", socket.id, {
      userId: user._id,
      username: user.username,
      role: user.role,
    });

    next();
  } catch (error) {
    logger.securityEvent("socket-auth-error", null, {
      socketId: socket.id,
      error: error.message,
    });

    if (error.name === "JsonWebTokenError") {
      return next(new Error("Invalid token"));
    }
    if (error.name === "TokenExpiredError") {
      return next(new Error("Token expired"));
    }

    next(new Error("Authentication failed"));
  }
};

/**
 * Socket authorization middleware
 */
export const authorizeSocket = (roles = []) => {
  return (socket, next) => {
    if (!socket.user) {
      return next(new Error("Authentication required"));
    }

    if (roles.length > 0 && !roles.includes(socket.user.role)) {
      logger.securityEvent("socket-unauthorized-access", socket.user, {
        socketId: socket.id,
        attemptedAction: "socket-connection",
        requiredRoles: roles,
      });
      return next(new Error("Insufficient permissions"));
    }

    next();
  };
};
