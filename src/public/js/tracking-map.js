class TrackingMap {
  constructor() {
    this.map = null;
    this.deliveryMarker = null;
    this.routeLayer = null;
    this.socket = io();
    this.currentDelivery = null;

    this.initMap();
    this.initSocket();
    this.initTrackingForm();
  }

  initMap() {
    mapboxgl.accessToken = "YOUR_MAPBOX_ACCESS_TOKEN";

    this.map = new mapboxgl.Map({
      container: "tracking-map",
      style: "mapbox://styles/mapbox/streets-v11",
      center: [-74.5, 40],
      zoom: 9,
    });

    this.map.addControl(new mapboxgl.NavigationControl());
  }

  initSocket() {
    this.socket.on("delivery-data", (data) => {
      this.handleDeliveryData(data);
    });

    this.socket.on("location-updated", (data) => {
      this.updateDeliveryLocation(data);
    });

    this.socket.on("breakdown-reported", (data) => {
      this.handleBreakdown(data);
    });

    this.socket.on("error", (error) => {
      this.showNotification(error.message, "error");
    });
  }

  initTrackingForm() {
    const form = document.getElementById("tracking-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const trackingCode = document.getElementById("tracking-code").value;
      this.trackDelivery(trackingCode);
    });
  }

  trackDelivery(trackingCode) {
    fetch(`/api/v1/deliveries/track/${trackingCode}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          this.currentDelivery = data.delivery;
          this.socket.emit("join-delivery", data.delivery.deliveryId);
          this.showDeliveryInfo(data.delivery);
        } else {
          this.showNotification("Delivery not found", "error");
        }
      })
      .catch((error) => {
        this.showNotification("Error tracking delivery", "error");
      });
  }

  handleDeliveryData(data) {
    if (!data || !data.delivery) return;

    // Center map on delivery location
    if (data.delivery.currentLocation) {
      this.map.flyTo({
        center: [
          data.delivery.currentLocation.lng,
          data.delivery.currentLocation.lat,
        ],
        zoom: 12,
      });
    }

    // Add delivery marker
    if (this.deliveryMarker) {
      this.deliveryMarker.remove();
    }

    this.deliveryMarker = new mapboxgl.Marker({
      color: "#3B82F6",
      scale: 1.2,
    })
      .setLngLat([
        data.delivery.currentLocation.lng,
        data.delivery.currentLocation.lat,
      ])
      .setPopup(
        new mapboxgl.Popup().setHTML(`
            <div class="p-2">
                <h3 class="font-semibold">${data.delivery.recipient.name}</h3>
                <p class="text-sm text-gray-600">${data.delivery.currentStatus}</p>
            </div>
        `)
      )
      .addTo(this.map);

    // Draw route if available
    this.drawRoute(data.route, data.locationLogs);
  }

  updateDeliveryLocation(data) {
    if (this.deliveryMarker) {
      this.deliveryMarker.setLngLat([
        data.coordinates.lng,
        data.coordinates.lat,
      ]);

      // Smooth animation
      this.map.flyTo({
        center: [data.coordinates.lng, data.coordinates.lat],
        essential: true,
      });
    }
  }

  drawRoute(route, locationLogs) {
    // Remove existing route layer
    if (this.routeLayer) {
      this.map.removeLayer("route");
      this.map.removeSource("route");
    }

    if (!route || route.length === 0) return;

    const coordinates = route.map((point) => [
      point.location.coordinates.lng,
      point.location.coordinates.lat,
    ]);

    this.map.addSource("route", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: coordinates,
        },
      },
    });

    this.map.addLayer({
      id: "route",
      type: "line",
      source: "route",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#3B82F6",
        "line-width": 4,
        "line-opacity": 0.6,
      },
    });

    this.routeLayer = "route";
  }

  handleBreakdown(data) {
    // Add breakdown marker
    const breakdown = data.breakdown;
    const marker = new mapboxgl.Marker({
      color: "#EF4444",
    })
      .setLngLat([
        breakdown.location.coordinates.lng,
        breakdown.location.coordinates.lat,
      ])
      .setPopup(
        new mapboxgl.Popup().setHTML(`
            <div class="p-2 max-w-xs">
                <h3 class="font-semibold text-red-600">🚨 Breakdown Reported</h3>
                <p class="text-sm mt-1">${breakdown.description}</p>
                <p class="text-xs text-gray-500 mt-1">
                    Severity: <span class="font-medium">${
                      breakdown.severity
                    }</span>
                </p>
                <p class="text-xs text-gray-500">
                    ${new Date(breakdown.timestamp).toLocaleString()}
                </p>
            </div>
        `)
      )
      .addTo(this.map);

    // Show notification
    this.showNotification(
      `Breakdown reported: ${breakdown.description}`,
      "warning"
    );
  }

  showNotification(message, type = "info") {
    // Implementation for showing notifications
    const notification = document.createElement("div");
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg ${
      type === "error"
        ? "bg-red-500 text-white"
        : type === "warning"
        ? "bg-yellow-500 text-black"
        : "bg-blue-500 text-white"
    }`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  showDeliveryInfo(delivery) {
    const infoPanel = document.getElementById("delivery-info");
    infoPanel.innerHTML = `
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-lg font-semibold mb-4">Delivery Information</h3>
                
                <div class="space-y-3">
                    <div class="flex justify-between">
                        <span class="text-gray-600">Recipient:</span>
                        <span class="font-medium">${
                          delivery.recipient.name
                        }</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Status:</span>
                        <span class="font-medium capitalize">${
                          delivery.currentStatus
                        }</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Estimated Delivery:</span>
                        <span class="font-medium">${new Date(
                          delivery.estimatedDelivery
                        ).toLocaleDateString()}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Tracking Code:</span>
                        <span class="font-mono font-medium">${
                          delivery.trackingCode
                        }</span>
                    </div>
                </div>

                <div class="mt-6">
                    <h4 class="font-semibold mb-3">Timeline</h4>
                    <div class="space-y-2">
                        ${delivery.timeline
                          .map(
                            (event) => `
                            <div class="flex items-start">
                                <div class="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-blue-500"></div>
                                <div class="ml-3">
                                    <p class="text-sm font-medium">${
                                      event.description
                                    }</p>
                                    <p class="text-xs text-gray-500">${new Date(
                                      event.timestamp
                                    ).toLocaleString()}</p>
                                </div>
                            </div>
                        `
                          )
                          .join("")}
                    </div>
                </div>
            </div>
        `;
  }
}

// Initialize tracking map when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new TrackingMap();
});
