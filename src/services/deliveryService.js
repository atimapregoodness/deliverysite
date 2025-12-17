const Delivery = require("../models/Delivery");
const { uploadToCloudinary } = require("../config/cloudinary");

class DeliveryService {
  static async createDelivery(deliveryData, userId) {
    try {
      // Generate tracking ID if not provided
      if (!deliveryData.trackingId) {
        deliveryData.trackingId = Delivery.generateTrackingId();
      }

      // Convert dates and ensure proper structure
      if (deliveryData.estimatedDelivery) {
        deliveryData.estimatedDelivery = new Date(
          deliveryData.estimatedDelivery
        );
      }

      if (deliveryData.pickup && deliveryData.pickup.scheduledDate) {
        deliveryData.pickup.scheduledDate = new Date(
          deliveryData.pickup.scheduledDate
        );
      }

      // Create the delivery
      const delivery = new Delivery({
        ...deliveryData,
        createdBy: userId,
        timeline: {
          created: new Date(),
          updated: new Date(),
        },
      });

      await delivery.save();
      return delivery;
    } catch (error) {
      console.error("Error creating delivery:", error);
      throw error;
    }
  }

  static async updateDeliveryLocation(deliveryId, locationData) {
    try {
      const delivery = await Delivery.findById(deliveryId);
      if (!delivery) throw new Error("Delivery not found");

      // Update tracking data
      delivery.trackingData.currentLocation = {
        type: "Point",
        coordinates: [locationData.longitude, locationData.latitude],
      };
      delivery.trackingData.lastUpdated = new Date();

      if (locationData.speed !== undefined) {
        delivery.trackingData.speed = locationData.speed;
      }

      if (locationData.bearing !== undefined) {
        delivery.trackingData.bearing = locationData.bearing;
      }

      // Add route waypoint
      if (!delivery.route.waypoints) {
        delivery.route.waypoints = [];
      }

      const waypoint = {
        sequence: delivery.route.waypoints.length + 1,
        location: {
          type: "Point",
          coordinates: [locationData.longitude, locationData.latitude],
        },
        address: locationData.address || "Unknown location",
        type: "checkpoint",
        status: "arrived",
        actualArrival: new Date(),
      };

      delivery.route.waypoints.push(waypoint);

      // Calculate route progress
      delivery.trackingData.routeProgress = delivery.calculateProgress();

      delivery.updatedAt = new Date();
      await delivery.save();
      return delivery;
    } catch (error) {
      console.error("Error updating delivery location:", error);
      throw error;
    }
  }

  static async addDelay(deliveryId, delayData, images = []) {
    try {
      const uploadedImages = [];

      // Upload images to Cloudinary if provided
      if (images && images.length > 0) {
        for (const image of images) {
          const result = await uploadToCloudinary(
            image.path,
            "delivery-delays"
          );
          uploadedImages.push(result.secure_url);
        }
      }

      const delivery = await Delivery.findById(deliveryId);
      if (!delivery) throw new Error("Delivery not found");

      // Update delay info
      delivery.delayInfo = {
        reason: delayData.reason,
        description: delayData.description,
        estimatedDelay: delayData.estimatedDelay || 0,
        reportedAt: new Date(),
        reportedBy: delayData.reportedBy,
        images: uploadedImages,
      };

      // Update status
      delivery.status = "delayed";

      // Update notifications
      delivery.notifications.sender.delayed = true;
      delivery.notifications.receiver.delayed = true;

      delivery.updatedAt = new Date();
      await delivery.save();
      return delivery;
    } catch (error) {
      console.error("Error adding delay:", error);
      throw error;
    }
  }

  static async getDeliveryByTrackingId(trackingId) {
    try {
      const delivery = await Delivery.findOne({ trackingId })
        .populate("createdBy", "name email username")
        .populate("driver", "name phone email")
        .populate("vehicle", "licensePlate model make")
        .populate("delayInfo.reportedBy", "name phone");

      if (!delivery) {
        // Also try searching by ID if trackingId doesn't match
        return await Delivery.findById(trackingId)
          .populate("createdBy", "name email username")
          .populate("driver", "name phone email")
          .populate("vehicle", "licensePlate model make")
          .populate("delayInfo.reportedBy", "name phone");
      }

      return delivery;
    } catch (error) {
      console.error("Error fetching delivery by tracking ID:", error);
      throw error;
    }
  }

  static async getAllDeliveries(filters = {}) {
    try {
      const query = {};

      // Status filter
      if (filters.status && filters.status !== "all") {
        query.status = filters.status;
      }

      // Search filter
      if (filters.search) {
        query.$or = [
          { trackingId: { $regex: filters.search, $options: "i" } },
          { "receiver.name": { $regex: filters.search, $options: "i" } },
          { "receiver.email": { $regex: filters.search, $options: "i" } },
          { "receiver.phone": { $regex: filters.search, $options: "i" } },
          { "sender.name": { $regex: filters.search, $options: "i" } },
          { "sender.email": { $regex: filters.search, $options: "i" } },
          { "sender.phone": { $regex: filters.search, $options: "i" } },
        ];
      }

      // Priority filter
      if (filters.priority && filters.priority !== "all") {
        query.priority = filters.priority;
      }

      // Service type filter
      if (filters.serviceType && filters.serviceType !== "all") {
        query.serviceType = filters.serviceType;
      }

      // Date range filter
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
          query.createdAt.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.createdAt.$lte = new Date(filters.endDate);
        }
      }

      const deliveries = await Delivery.find(query)
        .populate("createdBy", "name email")
        .populate("driver", "name phone")
        .populate("vehicle", "licensePlate")
        .sort({
          priority: -1,
          estimatedDelivery: 1,
          createdAt: -1,
        });

      return deliveries;
    } catch (error) {
      console.error("Error fetching all deliveries:", error);
      throw error;
    }
  }

  static async getDeliveryById(id) {
    try {
      const delivery = await Delivery.findById(id)
        .populate("createdBy", "name email username")
        .populate("driver", "name phone email")
        .populate("vehicle", "licensePlate model make")
        .populate("updatedBy", "name email")
        .populate("delayInfo.reportedBy", "name phone");

      return delivery;
    } catch (error) {
      console.error("Error fetching delivery by ID:", error);
      throw error;
    }
  }

  static async updateDelivery(id, updateData, userId) {
    try {
      const delivery = await Delivery.findById(id);
      if (!delivery) throw new Error("Delivery not found");

      // Update fields
      Object.keys(updateData).forEach((key) => {
        if (key === "driver" || key === "vehicle") {
          // Handle ObjectId fields
          delivery[key] = updateData[key] || null;
        } else if (key === "estimatedDelivery") {
          // Handle date fields
          delivery[key] = new Date(updateData[key]);
        } else if (key === "pickup") {
          // Handle nested pickup object
          if (!delivery.pickup) delivery.pickup = {};
          Object.keys(updateData.pickup).forEach((pickupKey) => {
            if (pickupKey === "scheduledDate" || pickupKey === "actualDate") {
              delivery.pickup[pickupKey] = updateData.pickup[pickupKey]
                ? new Date(updateData.pickup[pickupKey])
                : null;
            } else {
              delivery.pickup[pickupKey] = updateData.pickup[pickupKey];
            }
          });
        } else if (
          typeof updateData[key] === "object" &&
          updateData[key] !== null
        ) {
          // Handle nested objects
          if (!delivery[key]) delivery[key] = {};
          Object.keys(updateData[key]).forEach((nestedKey) => {
            delivery[key][nestedKey] = updateData[key][nestedKey];
          });
        } else {
          // Handle simple fields
          delivery[key] = updateData[key];
        }
      });

      // Update audit fields
      delivery.updatedAt = new Date();
      delivery.updatedBy = userId;

      await delivery.save();
      return delivery;
    } catch (error) {
      console.error("Error updating delivery:", error);
      throw error;
    }
  }

  static async deleteDelivery(id) {
    try {
      const delivery = await Delivery.findByIdAndDelete(id);
      return delivery;
    } catch (error) {
      console.error("Error deleting delivery:", error);
      throw error;
    }
  }

  static async updateDeliveryStatus(id, status, userId, notes = "") {
    try {
      const delivery = await Delivery.findById(id);
      if (!delivery) throw new Error("Delivery not found");

      const oldStatus = delivery.status;
      delivery.status = status;
      delivery.updatedAt = new Date();

      // Update timeline based on status
      if (status === "delivered") {
        delivery.actualDelivery = new Date();
      } else if (status === "picked_up") {
        delivery.pickup.actualDate = new Date();
        delivery.pickup.completed = true;
      } else if (status === "in_transit") {
        delivery.trackingData.active = true;
      }

      // Add status history entry (if statusHistory doesn't exist, create it)
      if (!delivery.statusHistory) {
        delivery.statusHistory = [];
      }

      delivery.statusHistory.push({
        status: status,
        changedAt: new Date(),
        changedBy: userId,
        notes: notes || `Status changed from ${oldStatus} to ${status}`,
      });

      // Update notifications
      if (status === "delivered") {
        delivery.notifications.sender.delivered = true;
        delivery.notifications.receiver.delivered = true;
      } else if (status === "out_for_delivery") {
        delivery.notifications.receiver.outForDelivery = true;
      }

      await delivery.save();
      return delivery;
    } catch (error) {
      console.error("Error updating delivery status:", error);
      throw error;
    }
  }

  static async markAsPickedUp(deliveryId, proof = {}, userId) {
    try {
      const delivery = await Delivery.findById(deliveryId);
      if (!delivery) throw new Error("Delivery not found");

      await delivery.markAsPickedUp(proof);

      // Update status
      delivery.status = "picked_up";
      delivery.updatedAt = new Date();
      delivery.updatedBy = userId;

      await delivery.save();
      return delivery;
    } catch (error) {
      console.error("Error marking as picked up:", error);
      throw error;
    }
  }

  static async markAsDelivered(deliveryId, proof = {}, userId) {
    try {
      const delivery = await Delivery.findById(deliveryId);
      if (!delivery) throw new Error("Delivery not found");

      await delivery.markAsDelivered(proof);

      // Update notifications
      delivery.notifications.sender.delivered = true;
      delivery.notifications.receiver.delivered = true;

      delivery.updatedAt = new Date();
      delivery.updatedBy = userId;

      await delivery.save();
      return delivery;
    } catch (error) {
      console.error("Error marking as delivered:", error);
      throw error;
    }
  }

  static async assignDriver(deliveryId, driverId, vehicleId = null) {
    try {
      const delivery = await Delivery.findById(deliveryId);
      if (!delivery) throw new Error("Delivery not found");

      delivery.driver = driverId;
      if (vehicleId) {
        delivery.vehicle = vehicleId;
      }

      delivery.status = "confirmed";
      delivery.updatedAt = new Date();

      await delivery.save();
      return delivery;
    } catch (error) {
      console.error("Error assigning driver:", error);
      throw error;
    }
  }

  static async getDeliveriesByDriver(driverId, statusFilter = null) {
    try {
      const query = { driver: driverId };

      if (statusFilter && statusFilter !== "all") {
        query.status = statusFilter;
      }

      const deliveries = await Delivery.find(query)
        .populate("receiver", "name phone address")
        .populate("sender", "name phone address")
        .populate("vehicle", "licensePlate model")
        .sort({
          priority: -1,
          estimatedDelivery: 1,
        });

      return deliveries;
    } catch (error) {
      console.error("Error fetching deliveries by driver:", error);
      throw error;
    }
  }

  static async getStatistics() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const total = await Delivery.countDocuments();
      const delivered = await Delivery.countDocuments({ status: "delivered" });
      const inTransit = await Delivery.countDocuments({ status: "in_transit" });
      const outForDelivery = await Delivery.countDocuments({
        status: "out_for_delivery",
      });
      const pending = await Delivery.countDocuments({ status: "pending" });
      const delayed = await Delivery.countDocuments({ status: "delayed" });

      // Today's deliveries
      const todaysDeliveries = await Delivery.countDocuments({
        estimatedDelivery: { $gte: today, $lt: tomorrow },
      });

      // Overdue deliveries
      const overdue = await Delivery.countDocuments({
        estimatedDelivery: { $lt: today },
        status: { $nin: ["delivered", "cancelled"] },
      });

      return {
        total,
        delivered,
        inTransit,
        outForDelivery,
        pending,
        delayed,
        todaysDeliveries,
        overdue,
        deliveryRate: total > 0 ? ((delivered / total) * 100).toFixed(1) : 0,
      };
    } catch (error) {
      console.error("Error fetching delivery statistics:", error);
      throw error;
    }
  }

  static async getRecentDeliveries(limit = 10) {
    try {
      const deliveries = await Delivery.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("createdBy", "name")
        .populate("driver", "name");

      return deliveries;
    } catch (error) {
      console.error("Error fetching recent deliveries:", error);
      throw error;
    }
  }

  static async searchDeliveries(searchTerm) {
    try {
      const deliveries = await Delivery.find({
        $or: [
          { trackingId: { $regex: searchTerm, $options: "i" } },
          { "receiver.name": { $regex: searchTerm, $options: "i" } },
          { "receiver.phone": { $regex: searchTerm, $options: "i" } },
          { "receiver.email": { $regex: searchTerm, $options: "i" } },
          { "sender.name": { $regex: searchTerm, $options: "i" } },
          { "sender.phone": { $regex: searchTerm, $options: "i" } },
          { "sender.email": { $regex: searchTerm, $options: "i" } },
        ],
      })
        .limit(20)
        .sort({ createdAt: -1 });

      return deliveries;
    } catch (error) {
      console.error("Error searching deliveries:", error);
      throw error;
    }
  }
}

module.exports = DeliveryService;
