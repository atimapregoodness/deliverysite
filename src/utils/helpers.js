const moment = require("moment");

const formatDate = (date) => {
  return moment(date).format("MMM DD, YYYY HH:mm");
};

const generateMapUrl = (latitude, longitude, zoom = 14) => {
  return `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=${zoom}&size=600x300&maptype=roadmap&markers=color:red%7C${latitude},${longitude}&key=${
    process.env.GOOGLE_MAPS_API_KEY || ""
  }`;
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getStatusColor = (status) => {
  const colors = {
    pending: "bg-gray-500",
    picked_up: "bg-blue-500",
    in_transit: "bg-yellow-500",
    out_for_delivery: "bg-orange-500",
    delivered: "bg-green-500",
    delayed: "bg-red-500",
    cancelled: "bg-gray-700",
  };
  return colors[status] || "bg-gray-500";
};

const getSeverityColor = (severity) => {
  const colors = {
    low: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-orange-100 text-orange-800",
    critical: "bg-red-100 text-red-800",
  };
  return colors[severity] || "bg-gray-100 text-gray-800";
};



// Helper function to calculate coordinates by progress percentage for Mapbox
const calculateCoordinatesByProgress = async (delivery, progress) => {
  try {
    // Priority 1: Use Mapbox route geometry if available
    if (delivery.route?.geometry?.coordinates?.length > 0) {
      const coords = delivery.route.geometry.coordinates;
      const totalPoints = coords.length;
      const pointIndex = Math.floor((progress / 100) * (totalPoints - 1));
      return coords[Math.min(pointIndex, totalPoints - 1)];
    }

    // Priority 2: Use waypoints if available
    if (delivery.trackingData?.waypoints?.length > 0) {
      const totalWaypoints = delivery.trackingData.waypoints.length;
      const waypointIndex = Math.floor((progress / 100) * (totalWaypoints - 1));
      const waypoint =
        delivery.trackingData.waypoints[
          Math.min(waypointIndex, totalWaypoints - 1)
        ];
      if (waypoint?.coordinates) {
        return waypoint.coordinates;
      }
    }

    // Fallback: Linear interpolation between start and end
    const startCoords = delivery.sender?.address?.coordinates?.coordinates || [
      0, 0,
    ];
    const endCoords = delivery.receiver?.address?.coordinates?.coordinates || [
      0, 0,
    ];

    if (startCoords[0] === 0 && startCoords[1] === 0) {
      return null; // Can't calculate
    }
    if (endCoords[0] === 0 && endCoords[1] === 0) {
      return null; // Can't calculate
    }

    const percentage = progress / 100;
    const lon = startCoords[0] + (endCoords[0] - startCoords[0]) * percentage;
    const lat = startCoords[1] + (endCoords[1] - startCoords[1]) * percentage;

    return [lon, lat];
  } catch (error) {
    console.error("Error calculating coordinates by progress:", error);
    return null;
  }
};

// Optional: Calculate progress from coordinates (for reverse calculation)
const calculateProgressFromCoordinates = async (delivery, coordinates) => {
  try {
    const startCoords = delivery.sender?.address?.coordinates?.coordinates || [
      0, 0,
    ];
    const endCoords = delivery.receiver?.address?.coordinates?.coordinates || [
      0, 0,
    ];

    if (startCoords[0] === 0 && startCoords[1] === 0) {
      throw new Error("Sender coordinates not available");
    }
    if (endCoords[0] === 0 && endCoords[1] === 0) {
      throw new Error("Receiver coordinates not available");
    }

    // Calculate distance from start to current point
    const startToCurrent = haversineDistance(startCoords, coordinates);
    const startToEnd = haversineDistance(startCoords, endCoords);

    if (startToEnd === 0) return 0;

    const progress = (startToCurrent / startToEnd) * 100;
    return Math.min(100, Math.max(0, progress));
  } catch (error) {
    console.error("Error calculating progress from coordinates:", error);
    return delivery.trackingData?.vehicleProgress || 0;
  }
};

// Haversine distance calculation for Mapbox
const haversineDistance = (coord1, coord2) => {
  const toRad = (x) => (x * Math.PI) / 180;

  const R = 6371000; // Earth's radius in meters
  const φ1 = toRad(coord1[1]);
  const φ2 = toRad(coord2[1]);
  const Δφ = toRad(coord2[1] - coord1[1]);
  const Δλ = toRad(coord2[0] - coord1[0]);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};





module.exports = {

  formatDate,
  generateMapUrl,
  calculateDistance,
  getStatusColor,
  getSeverityColor,

  calculateCoordinatesByProgress,
  calculateProgressFromCoordinates,
  haversineDistance,
};
