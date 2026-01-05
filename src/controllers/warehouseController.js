const { Warehouse } = require("../models");
const mongoose = require("mongoose");

class WarehouseController {
  // Get all warehouses with filtering
  getAllWarehouses = async (req, res) => {
    try {
      const { search } = req.query;
      let query = {};

      // Search filter
      if (search) {
        query.name = { $regex: search, $options: "i" };
      }

      // Fetch warehouses
      const warehouses = await Warehouse.find(query).sort({ name: 1 });

      res.render("admin/warehouses/warehouses", {
        title: "Warehouse Management",
        warehouses,
        query: req.query,
        messages: req.flash(),
      });
    } catch (error) {
      console.error("Error fetching warehouses:", error);
      req.flash("error", "Error loading warehouses");
      res.redirect("/admin");
    }
  };

  // Show form for creating new warehouse
  getCreateWarehouse = async (req, res) => {
    try {
      res.render("admin/warehouses/new", {
        title: "Add New Warehouse",
        messages: req.flash(),
      });
    } catch (error) {
      console.error("Error loading create form:", error);
      req.flash("error", "Error loading form");
      res.redirect("/admin/warehouses");
    }
  };

  // Create new warehouse
  postCreateWarehouse = async (req, res) => {
    try {
      const { name, latitude, longitude } = req.body;

      // Check if warehouse name already exists
      const existingWarehouse = await Warehouse.findOne({ name });
      if (existingWarehouse) {
        req.flash("error", "Warehouse with this name already exists");
        return res.render("admin/warehouses/new", {
          title: "Add New Warehouse",
          warehouse: req.body,
          messages: req.flash(),
        });
      }

      // Validate coordinates
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      
      if (isNaN(lat) || isNaN(lng)) {
        req.flash("error", "Invalid coordinates provided");
        return res.render("admin/warehouses/new", {
          title: "Add New Warehouse",
          warehouse: req.body,
          messages: req.flash(),
        });
      }

      // Validate latitude range (-90 to 90)
      if (lat < -90 || lat > 90) {
        req.flash("error", "Latitude must be between -90 and 90 degrees");
        return res.render("admin/warehouses/new", {
          title: "Add New Warehouse",
          warehouse: req.body,
          messages: req.flash(),
        });
      }

      // Validate longitude range (-180 to 180)
      if (lng < -180 || lng > 180) {
        req.flash("error", "Longitude must be between -180 and 180 degrees");
        return res.render("admin/warehouses/new", {
          title: "Add New Warehouse",
          warehouse: req.body,
          messages: req.flash(),
        });
      }

      // Create warehouse
      const warehouse = new Warehouse({
        name,
        location: {
          type: "Point",
          coordinates: [lng, lat], // MongoDB expects [longitude, latitude]
        },
      });

      await warehouse.save();

      req.flash("success", "Warehouse created successfully");
      res.redirect("/admin/warehouses");
    } catch (error) {
      console.error("Error creating warehouse:", error);
      
      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map(val => val.message);
        req.flash("error", messages.join(", "));
      } else {
        req.flash("error", "Error creating warehouse");
      }
      
      res.render("admin/warehouses/new", {
        title: "Add New Warehouse",
        warehouse: req.body,
        messages: req.flash(),
      });
    }
  };

  // Show single warehouse
  getWarehouse = async (req, res) => {
    try {
      const warehouse = await Warehouse.findById(req.params.id);

      if (!warehouse) {
        req.flash("error", "Warehouse not found");
        return res.redirect("/admin/warehouses");
      }

      res.render("admin/warehouses/show", {
        title: `Warehouse: ${warehouse.name}`,
        warehouse,
        messages: req.flash(),
      });
    } catch (error) {
      console.error("Error fetching warehouse:", error);
      req.flash("error", "Error loading warehouse details");
      res.redirect("/admin/warehouses");
    }
  };

  // Show edit form
  getEditWarehouse = async (req, res) => {
    try {
      const warehouse = await Warehouse.findById(req.params.id);

      if (!warehouse) {
        req.flash("error", "Warehouse not found");
        return res.redirect("/admin/warehouses");
      }

      res.render("admin/warehouses/edit", {
        title: `Edit Warehouse: ${warehouse.name}`,
        warehouse,
        messages: req.flash(),
      });
    } catch (error) {
      console.error("Error loading edit form:", error);
      req.flash("error", "Error loading edit form");
      res.redirect("/admin/warehouses");
    }
  };

  // Update warehouse
  putUpdateWarehouse = async (req, res) => {
    try {
      const { name, latitude, longitude } = req.body;
      
      // Check if warehouse name is being changed and if it already exists
      if (name) {
        const existingWarehouse = await Warehouse.findOne({
          name,
          _id: { $ne: req.params.id }
        });
        
        if (existingWarehouse) {
          req.flash("error", "Another warehouse already has this name");
          return res.redirect(`/admin/warehouses/${req.params.id}/edit`);
        }
      }

      // Validate coordinates
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      
      if (isNaN(lat) || isNaN(lng)) {
        req.flash("error", "Invalid coordinates provided");
        return res.redirect(`/admin/warehouses/${req.params.id}/edit`);
      }

      // Validate latitude range (-90 to 90)
      if (lat < -90 || lat > 90) {
        req.flash("error", "Latitude must be between -90 and 90 degrees");
        return res.redirect(`/admin/warehouses/${req.params.id}/edit`);
      }

      // Validate longitude range (-180 to 180)
      if (lng < -180 || lng > 180) {
        req.flash("error", "Longitude must be between -180 and 180 degrees");
        return res.redirect(`/admin/warehouses/${req.params.id}/edit`);
      }

      const updateData = {
        name,
        location: {
          type: "Point",
          coordinates: [lng, lat], // MongoDB expects [longitude, latitude]
        },
      };

      const warehouse = await Warehouse.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!warehouse) {
        req.flash("error", "Warehouse not found");
        return res.redirect("/admin/warehouses");
      }

      req.flash("success", "Warehouse updated successfully");
      res.redirect("/admin/warehouses");
    } catch (error) {
      console.error("Error updating warehouse:", error);
      
      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map(val => val.message);
        req.flash("error", messages.join(", "));
      } else {
        req.flash("error", "Error updating warehouse");
      }
      
      res.redirect(`/admin/warehouses/${req.params.id}/edit`);
    }
  };

  // Delete warehouse
  deleteWarehouse = async (req, res) => {
    try {
      const warehouse = await Warehouse.findById(req.params.id);

      if (!warehouse) {
        return res.status(404).json({
          success: false,
          error: "Warehouse not found",
        });
      }

      // Check if warehouse is being used in any deliveries
      // This would require checking the Delivery model for references
      // For now, we'll allow deletion but you might want to add this check
      
      await Warehouse.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: "Warehouse deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting warehouse:", error);
      res.status(500).json({
        success: false,
        error: "Error deleting warehouse",
      });
    }
  };

  // Get warehouses near a location (API endpoint)
  getNearbyWarehouses = async (req, res) => {
    try {
      const { longitude, latitude, maxDistance = 10000 } = req.query;
      
      if (!longitude || !latitude) {
        return res.status(400).json({
          success: false,
          error: "Longitude and latitude are required",
        });
      }

      const warehouses = await Warehouse.find({
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [parseFloat(longitude), parseFloat(latitude)],
            },
            $maxDistance: parseInt(maxDistance), // In meters
          },
        },
      }).limit(10);

      res.json({
        success: true,
        data: warehouses,
      });
    } catch (error) {
      console.error("Error finding nearby warehouses:", error);
      res.status(500).json({
        success: false,
        error: "Error finding nearby warehouses",
      });
    }
  };

  // Bulk create warehouses (for testing/initial setup)
  postBulkCreateWarehouses = async (req, res) => {
    try {
      const { warehouses } = req.body;
      
      if (!Array.isArray(warehouses) || warehouses.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Warehouses array is required",
        });
      }

      const createdWarehouses = await Warehouse.insertMany(warehouses);

      res.json({
        success: true,
        message: `${createdWarehouses.length} warehouses created successfully`,
        data: createdWarehouses,
      });
    } catch (error) {
      console.error("Error bulk creating warehouses:", error);
      res.status(500).json({
        success: false,
        error: "Error creating warehouses",
      });
    }
  };
}

module.exports = new WarehouseController();