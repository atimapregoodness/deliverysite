// utils/deliveryUtils.js
const Delivery = require("../models/Delivery");

const deliveryUtils = {
  // Generate tracking ID
  generateTrackingId: () => {
    const prefix = "DEL";
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  },

  // Calculate ETA based on distance and traffic
  calculateETA: (startCoords, endCoords, trafficConditions) => {
    // Calculate distance using Haversine formula
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371; // Earth radius in km

    const lat1 = toRad(startCoords[1]);
    const lat2 = toRad(endCoords[1]);
    const lon1 = toRad(startCoords[0]);
    const lon2 = toRad(endCoords[0]);

    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km

    // Average speed (adjust based on traffic)
    let avgSpeed = 40; // km/h
    if (trafficConditions === "heavy") avgSpeed = 20;
    if (trafficConditions === "light") avgSpeed = 60;

    // Calculate time in hours
    const timeHours = distance / avgSpeed;

    // Add buffer for stops and loading/unloading
    const bufferTime = 0.5; // 30 minutes
    const totalTimeHours = timeHours + bufferTime;

    // Convert to minutes
    const totalTimeMinutes = Math.ceil(totalTimeHours * 60);

    // Calculate ETA
    const now = new Date();
    const eta = new Date(now.getTime() + totalTimeMinutes * 60000);

    return {
      distance: distance,
      timeMinutes: totalTimeMinutes,
      eta: eta,
      avgSpeed: avgSpeed,
    };
  },

  // Format delivery status for display
  formatStatus: (status) => {
    const statusMap = {
      pending: { label: "Pending", color: "#f59e0b", icon: "fa-clock" },
      in_transit: { label: "In Transit", color: "#3b82f6", icon: "fa-truck" },
      delayed: {
        label: "Delayed",
        color: "#ef4444",
        icon: "fa-exclamation-triangle",
      },
      delivered: {
        label: "Delivered",
        color: "#10b981",
        icon: "fa-check-circle",
      },
      cancelled: {
        label: "Cancelled",
        color: "#6b7280",
        icon: "fa-times-circle",
      },
    };

    return (
      statusMap[status] || {
        label: status,
        color: "#6b7280",
        icon: "fa-question-circle",
      }
    );
  },

  // Validate address for geocoding
  validateAddress: (address) => {
    const errors = [];

    if (!address.street || address.street.trim().length < 5) {
      errors.push(
        "Street address is required and must be at least 5 characters"
      );
    }

    if (!address.city || address.city.trim().length < 2) {
      errors.push("City is required");
    }

    if (!address.country || address.country.trim().length < 2) {
      errors.push("Country is required");
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  },

  // Calculate delivery cost
  calculateCost: (packageData, serviceType, distance) => {
    let baseCost = 0;

    // Base cost by service type
    switch (serviceType) {
      case "express":
        baseCost = 19.99;
        break;
      case "standard":
        baseCost = 12.99;
        break;
      case "economy":
        baseCost = 8.99;
        break;
      default:
        baseCost = 12.99;
    }

    // Weight surcharge
    const weight = packageData.weight || 0;
    let weightSurcharge = 0;
    if (weight > 5) weightSurcharge = 5.99;
    if (weight > 10) weightSurcharge = 9.99;
    if (weight > 20) weightSurcharge = 19.99;

    // Distance surcharge
    const distanceSurcharge =
      distance > 50 ? Math.ceil((distance - 50) / 10) * 2.99 : 0;

    // Value insurance (optional)
    const insurance = packageData.value > 100 ? 2.99 : 0;

    // Tax
    const subtotal = baseCost + weightSurcharge + distanceSurcharge + insurance;
    const tax = subtotal * 0.08; // 8% tax

    const total = subtotal + tax;

    return {
      baseCost,
      weightSurcharge,
      distanceSurcharge,
      insurance,
      tax,
      total,
      breakdown: {
        base: baseCost,
        weight: weightSurcharge,
        distance: distanceSurcharge,
        insurance: insurance,
        tax: tax,
        total: total,
      },
    };
  },
};

module.exports = deliveryUtils;
