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

module.exports = {
  formatDate,
  generateMapUrl,
  calculateDistance,
  getStatusColor,
  getSeverityColor,
};
