const { Driver, Vehicle } = require("../models");
const mongoose = require("mongoose");

class DriverController {
  // Get all drivers with filtering
  getAllDrivers = async (req, res) => {
    try {
      const { search, status } = req.query;
      let query = {};

      // Search filter
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { licenseNumber: { $regex: search, $options: "i" } },
        ];
      }

      // Status filter
      if (status && status !== "all") {
        query.status = status;
      }

      // Fetch drivers with populated vehicle info
      const drivers = await Driver.find(query)
        .sort({ createdAt: -1 });

      res.render("admin/drivers/drivers", {
        title: "Driver Management", 
        drivers,
        query: req.query,
        messages: req.flash(),
      });
    } catch (error) {
      console.error("Error fetching drivers:", error);
      req.flash("error", "Error loading drivers");
      res.redirect("/admin");
    }
  };

  // Show form for creating new driver
  getCreateDriver = async (req, res) => {
    try {
      res.render("admin/drivers/new", {
        title: "Add New Driver",
        messages: req.flash(),
      });
    } catch (error) {
      console.error("Error loading create form:", error);
      req.flash("error", "Error loading form");
      res.redirect("/admin/drivers");
    }
  };

  // Create new driver
  postCreateDriver = async (req, res) => {
    try {
      const { name, email, phone,  photo, status, latitude, longitude } = req.body;



      // Create location object if coordinates provided
      let currentLocation = undefined;
      if (latitude && longitude) {
        currentLocation = {
          type: "Point",
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
          lastUpdated: new Date(),
        };
      }

      // Create driver
      const driver = new Driver({
        name,
        email,
        phone,

        photo: photo || undefined,
        status: status || "available",
        currentLocation,
        stats: {
          totalDeliveries: 0,
          onTimeDeliveries: 0,
          totalDistance: 0,
          ratingCount: 0,
        },
      });

      await driver.save();

      req.flash("success", "Driver created successfully");
      res.redirect("/admin/drivers");
    } catch (error) {
      console.error("Error creating driver:", error);
      
      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map(val => val.message);
        req.flash("error", messages.join(", "));
      } else {
        req.flash("error", "Error creating driver");
      }
      
      res.render("admin/drivers/new", {
        title: "Add New Driver",
        driver: req.body,
        messages: req.flash(),
      });
    }
  };

  // Show single driver
  getDriver = async (req, res) => {
    try {
      const driver = await Driver.findById(req.params.id)

        .populate("currentDeliveries");

      if (!driver) {
        req.flash("error", "Driver not found");
        return res.redirect("/admin/drivers");
      }

      res.render("admin/drivers/show", {
        title: `Driver: ${driver.name}`,
        driver,
        messages: req.flash(),
      });
    } catch (error) {
      console.error("Error fetching driver:", error);
      req.flash("error", "Error loading driver details");
      res.redirect("/admin/drivers");
    }
  };

  // Show edit form
  getEditDriver = async (req, res) => {
    try {
      const driver = await Driver.findById(req.params.id);

      if (!driver) {
        req.flash("error", "Driver not found");
        return res.redirect("/admin/drivers");
      }

      res.render("admin/drivers/edit", {
        title: `Edit Driver: ${driver.name}`,
        driver,
        messages: req.flash(),
      });
    } catch (error) {
      console.error("Error loading edit form:", error);
      req.flash("error", "Error loading edit form");
      res.redirect("/admin/drivers");
    }
  };

  // Update driver
  putUpdateDriver = async (req, res) => {
    try {
      const { name, email, phone, licenseNumber, photo, status, rating, latitude, longitude } = req.body;
      
      // Check if license number is being changed and if it already exists
      if (licenseNumber) {
        const existingDriver = await Driver.findOne({
          licenseNumber,
          _id: { $ne: req.params.id }
        });
        
        if (existingDriver) {
          req.flash("error", "Another driver already has this license number");
          return res.redirect(`/admin/drivers/${req.params.id}/edit`);
        }
      }

      const updateData = {
        name,
        email,
        phone,
        licenseNumber,
        photo: photo || null,
        status,
        rating: parseFloat(rating) || 4.5,
      };

      // Update location if coordinates provided
      if (latitude && longitude) {
        updateData.currentLocation = {
          type: "Point",
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
          lastUpdated: new Date(),
        };
      }

      // Update stats if provided
      if (req.body.stats) {
        updateData.stats = {
          totalDeliveries: parseInt(req.body.stats.totalDeliveries) || 0,
          onTimeDeliveries: parseInt(req.body.stats.onTimeDeliveries) || 0,
          totalDistance: parseFloat(req.body.stats.totalDistance) || 0,
          ratingCount: parseInt(req.body.stats.ratingCount) || 0,
        };
      }

      const driver = await Driver.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!driver) {
        req.flash("error", "Driver not found");
        return res.redirect("/admin/drivers");
      }

      req.flash("success", "Driver updated successfully");
      res.redirect("/admin/drivers");
    } catch (error) {
      console.error("Error updating driver:", error);
      
      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map(val => val.message);
        req.flash("error", messages.join(", "));
      } else {
        req.flash("error", "Error updating driver");
      }
      
      res.redirect(`/admin/drivers/${req.params.id}/edit`);
    }
  };

  // Delete driver
  deleteDriver = async (req, res) => {
    try {
      const driver = await Driver.findById(req.params.id);

      if (!driver) {
        return res.status(404).json({
          success: false,
          error: "Driver not found",
        });
      }

      // Check if driver has active deliveries
      if (driver.currentDeliveries && driver.currentDeliveries.length > 0) {
        return res.status(400).json({
          success: false,
          error: "Cannot delete driver with active deliveries",
        });
      }

      await Driver.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: "Driver deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting driver:", error);
      res.status(500).json({
        success: false,
        error: "Error deleting driver",
      });
    }
  };


  // Update driver status
  postUpdateStatus = async (req, res) => {
    try {
      const { status } = req.body;
      
      const driver = await Driver.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
      );

      if (!driver) {
        req.flash("error", "Driver not found");
        return res.redirect("/admin/drivers");
      }

      req.flash("success", `Driver status updated to ${status}`);
      res.redirect(`/admin/drivers/${req.params.id}`);
    } catch (error) {
      console.error("Error updating status:", error);
      req.flash("error", "Error updating driver status");
      res.redirect(`/admin/drivers/${req.params.id}`);
    }
  };
}

module.exports = new DriverController();