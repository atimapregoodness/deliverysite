const DeliveryService = require("../services/deliveryService");

const setupDeliverySockets = (io) => {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Join delivery room for real-time tracking
    socket.on("join-delivery", (deliveryId) => {
      socket.join(deliveryId);
      console.log(`Socket ${socket.id} joined delivery room: ${deliveryId}`);
    });

    // Update delivery location
    socket.on("update-location", async (data) => {
      try {
        const { deliveryId, latitude, longitude, address } = data;
        const updatedDelivery = await DeliveryService.updateDeliveryLocation(
          deliveryId,
          { latitude, longitude, address }
        );

        // Broadcast to all clients in the delivery room
        io.to(deliveryId).emit("location-updated", {
          deliveryId,
          location: updatedDelivery.currentLocation,
          route: updatedDelivery.route,
        });
      } catch (error) {
        socket.emit("error", { message: error.message });
      }
    });

    // Report incident
    socket.on("report-incident", async (data) => {
      try {
        const { deliveryId, type, description, severity, location } = data;
        const updatedDelivery = await DeliveryService.addIncident(deliveryId, {
          type,
          description,
          severity,
          location,
        });

        io.to(deliveryId).emit("incident-reported", {
          deliveryId,
          incident:
            updatedDelivery.incidents[updatedDelivery.incidents.length - 1],
        });
      } catch (error) {
        socket.emit("error", { message: error.message });
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};

module.exports = setupDeliverySockets;
