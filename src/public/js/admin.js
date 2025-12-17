// Admin Dashboard JavaScript with Charts and Analytics
class AdminDashboard {
  constructor() {
    this.charts = {};
    this.init();
  }

  async init() {
    await this.loadDashboardData();
    this.initCharts();
    this.setupRealTimeUpdates();
    this.setupDashboardInteractions();
  }

  async loadDashboardData() {
    try {
      const response = await fetch("/api/v1/admin/dashboard/stats");
      const data = await response.json();

      if (data.success) {
        this.updateDashboardStats(data.stats);
        this.updateChartsData(data);
      }
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    }
  }

  updateDashboardStats(stats) {
    // Update stat cards with animation
    this.animateValue("total-deliveries", 0, stats.totalDeliveries, 1500);
    this.animateValue("in-transit", 0, stats.inTransitDeliveries, 1500);
    this.animateValue("delayed", 0, stats.delayedDeliveries, 1500);
    this.animateValue("completed-today", 0, stats.deliveredThisWeek, 1500);

    // Update progress bars
    this.animateProgress(
      "transit-progress",
      (stats.inTransitDeliveries / stats.totalDeliveries) * 100
    );
  }

  animateValue(elementId, start, end, duration) {
    const element = document.getElementById(elementId);
    if (!element) return;

    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const value = Math.floor(progress * (end - start) + start);
      element.textContent = value.toLocaleString();

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }

  animateProgress(elementId, targetPercent) {
    const element = document.getElementById(elementId);
    if (!element) return;

    let currentPercent = 0;
    const duration = 1000;
    const increment = targetPercent / (duration / 16); // 60fps

    const animate = () => {
      currentPercent += increment;
      if (currentPercent < targetPercent) {
        element.style.width = currentPercent + "%";
        requestAnimationFrame(animate);
      } else {
        element.style.width = targetPercent + "%";
      }
    };
    animate();
  }

  initCharts() {
    this.initDeliveryTrendsChart();
    this.initStatusDistributionChart();
  }

  initDeliveryTrendsChart() {
    const ctx = document.getElementById("deliveryTrendsChart").getContext("2d");

    this.charts.trends = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Deliveries",
            data: [],
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            borderWidth: 3,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            mode: "index",
            intersect: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              drawBorder: false,
            },
          },
          x: {
            grid: {
              display: false,
            },
          },
        },
      },
    });
  }

  initStatusDistributionChart() {
    const ctx = document
      .getElementById("statusDistributionChart")
      .getContext("2d");

    this.charts.distribution = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["In Transit", "Delivered", "Processing", "Delayed", "Created"],
        datasets: [
          {
            data: [0, 0, 0, 0, 0],
            backgroundColor: [
              "#10b981",
              "#8b5cf6",
              "#f59e0b",
              "#ef4444",
              "#3b82f6",
            ],
            borderWidth: 2,
            borderColor: "#ffffff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              usePointStyle: true,
              padding: 20,
            },
          },
        },
      },
    });
  }

  updateChartsData(data) {
    // Update trends chart
    if (data.weeklyTrends && this.charts.trends) {
      const labels = data.weeklyTrends.map((trend) => trend._id);
      const values = data.weeklyTrends.map((trend) => trend.count);

      this.charts.trends.data.labels = labels;
      this.charts.trends.data.datasets[0].data = values;
      this.charts.trends.update();
    }

    // Update distribution chart
    if (data.stats && this.charts.distribution) {
      const distributionData = [
        data.stats.inTransitDeliveries || 0,
        data.stats.deliveredThisWeek || 0,
        data.stats.processingDeliveries || 0,
        data.stats.delayedDeliveries || 0,
        data.stats.createdDeliveries || 0,
      ];

      this.charts.distribution.data.datasets[0].data = distributionData;
      this.charts.distribution.update();
    }
  }

  setupRealTimeUpdates() {
    // Socket.io for real-time updates
    const socket = io();

    socket.on("delivery-updated", (data) => {
      this.showRealTimeNotification(data);
      this.loadDashboardData(); // Refresh data
    });

    socket.on("breakdown-reported", (data) => {
      this.showBreakdownAlert(data);
    });
  }

  showRealTimeNotification(data) {
    const notification = {
      success: `Delivery ${data.deliveryId} status updated to ${data.status}`,
      error: `Breakdown reported for delivery ${data.deliveryId}`,
      info: `New delivery created: ${data.deliveryId}`,
    }[data.type];

    if (notification) {
      window.ui.showNotification(notification, data.type);
    }
  }

  showBreakdownAlert(data) {
    const alertHTML = `
            <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded-r-lg animate-pulse">
                <div class="flex items-center">
                    <i class="fas fa-exclamation-triangle text-red-500 text-lg mr-3"></i>
                    <div>
                        <h4 class="font-semibold text-red-800">Breakdown Alert</h4>
                        <p class="text-red-700 text-sm">${data.description}</p>
                        <p class="text-red-600 text-xs">Delivery: ${data.deliveryId}</p>
                    </div>
                    <button onclick="this.parentElement.parentElement.remove()" class="ml-auto text-red-400 hover:text-red-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;

    // Prepend to dashboard
    const dashboard = document.querySelector(".max-w-7xl.mx-auto");
    if (dashboard) {
      dashboard.insertAdjacentHTML("afterbegin", alertHTML);
    }
  }

  setupDashboardInteractions() {
    // Refresh button
    document.getElementById("refresh-btn")?.addEventListener("click", () => {
      this.loadDashboardData();
    });

    // Auto-refresh every 30 seconds
    setInterval(() => {
      this.loadDashboardData();
    }, 30000);

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "r") {
        e.preventDefault();
        this.loadDashboardData();
      }
    });
  }
}

// Export dashboard setup
window.AdminDashboard = AdminDashboard;
