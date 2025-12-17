// Main JavaScript for the delivery tracker

document.addEventListener("DOMContentLoaded", function () {
  // Initialize tooltips
  const tooltips = document.querySelectorAll("[data-tooltip]");
  tooltips.forEach((tooltip) => {
    tooltip.addEventListener("mouseenter", showTooltip);
    tooltip.addEventListener("mouseleave", hideTooltip);
  });

  // Initialize date pickers
  const dateInputs = document.querySelectorAll('input[type="datetime-local"]');
  dateInputs.forEach((input) => {
    // Set min attribute to current datetime
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    input.min = now.toISOString().slice(0, 16);
  });

  // Auto-update relative times
  updateRelativeTimes();
  setInterval(updateRelativeTimes, 60000); // Update every minute

  // Initialize form validation
  const forms = document.querySelectorAll("form[needs-validation]");
  forms.forEach((form) => {
    form.addEventListener("submit", validateForm);
  });

  // Initialize image upload previews
  const imageInputs = document.querySelectorAll(
    'input[type="file"][accept^="image/"]'
  );
  imageInputs.forEach((input) => {
    input.addEventListener("change", handleImagePreview);
  });
});

// Tooltip functions
function showTooltip(event) {
  const tooltipText = event.target.getAttribute("data-tooltip");
  const tooltip = document.createElement("div");
  tooltip.className =
    "absolute z-50 px-2 py-1 text-sm text-white bg-gray-900 rounded shadow-lg";
  tooltip.textContent = tooltipText;
  tooltip.id = "tooltip";

  document.body.appendChild(tooltip);

  const rect = event.target.getBoundingClientRect();
  tooltip.style.left = `${rect.left + window.scrollX}px`;
  tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
}

function hideTooltip() {
  const tooltip = document.getElementById("tooltip");
  if (tooltip) {
    tooltip.remove();
  }
}

// Relative time updates
function updateRelativeTimes() {
  const timeElements = document.querySelectorAll("[data-time]");
  timeElements.forEach((element) => {
    const timestamp = element.getAttribute("data-time");
    const relativeTime = getRelativeTime(timestamp);
    element.textContent = relativeTime;
  });
}

function getRelativeTime(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 60) {
    return "just now";
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  }
}

// Form validation
function validateForm(event) {
  const form = event.target;
  const inputs = form.querySelectorAll(
    "input[required], select[required], textarea[required]"
  );
  let isValid = true;

  inputs.forEach((input) => {
    if (!input.value.trim()) {
      isValid = false;
      showInputError(input, "This field is required");
    } else {
      clearInputError(input);
    }

    // Email validation
    if (input.type === "email" && input.value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input.value)) {
        isValid = false;
        showInputError(input, "Please enter a valid email address");
      }
    }

    // Phone validation
    if (input.type === "tel" && input.value) {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(input.value.replace(/[\s\-\(\)]/g, ""))) {
        isValid = false;
        showInputError(input, "Please enter a valid phone number");
      }
    }
  });

  if (!isValid) {
    event.preventDefault();
    event.stopPropagation();

    // Scroll to first error
    const firstError = form.querySelector(".border-red-500");
    if (firstError) {
      firstError.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  form.classList.add("was-validated");
}

function showInputError(input, message) {
  input.classList.add("border-red-500");
  input.classList.remove("border-gray-300");

  let errorElement = input.parentNode.querySelector(".input-error");
  if (!errorElement) {
    errorElement = document.createElement("p");
    errorElement.className = "input-error mt-1 text-sm text-red-600";
    input.parentNode.appendChild(errorElement);
  }
  errorElement.textContent = message;
}

function clearInputError(input) {
  input.classList.remove("border-red-500");
  input.classList.add("border-gray-300");

  const errorElement = input.parentNode.querySelector(".input-error");
  if (errorElement) {
    errorElement.remove();
  }
}

// Image preview handling
function handleImagePreview(event) {
  const input = event.target;
  const previewContainer = input.parentNode.querySelector(".image-preview");

  if (!previewContainer) return;

  previewContainer.innerHTML = "";

  if (input.files && input.files[0]) {
    const reader = new FileReader();

    reader.onload = function (e) {
      const img = document.createElement("img");
      img.src = e.target.result;
      img.className = "h-20 w-20 object-cover rounded";
      previewContainer.appendChild(img);
    };

    reader.readAsDataURL(input.files[0]);
  }
}

// Utility functions
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function formatDate(dateString) {
  const options = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

// Socket.IO event handlers
function initializeDeliveryTracking(deliveryId) {
  const socket = io();

  socket.emit("join-delivery", deliveryId);

  socket.on("location-updated", (data) => {
    // Update map and UI with new location
    updateDeliveryLocation(data);
  });

  socket.on("incident-reported", (data) => {
    // Show incident notification
    showIncidentNotification(data.incident);
  });

  socket.on("status-changed", (data) => {
    // Update status in UI
    updateDeliveryStatus(data.status);
  });

  return socket;
}

function updateDeliveryLocation(data) {
  // This would be implemented based on your map library
  console.log("Location updated:", data);
}

function showIncidentNotification(incident) {
  const notification = document.createElement("div");
  notification.className =
    "fixed top-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg z-50";
  notification.innerHTML = `
        <div class="flex">
            <div class="flex-shrink-0">
                <i class="fas fa-exclamation-triangle text-red-400"></i>
            </div>
            <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800">Incident Reported</h3>
                <div class="mt-2 text-sm text-red-700">
                    <p>${incident.type}: ${incident.description}</p>
                </div>
            </div>
        </div>
    `;

  document.body.appendChild(notification);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

function updateDeliveryStatus(status) {
  const statusElement = document.querySelector(".delivery-status");
  if (statusElement) {
    statusElement.textContent = status.replace("_", " ").toUpperCase();
    statusElement.className = `status-badge status-${status}`;
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    debounce,
    formatDate,
    initializeDeliveryTracking,
  };
}
