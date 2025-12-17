const passport = require("passport");
const Admin = require("../models/Admin");

const authController = {
  showLogin: (req, res) => {
    res.render("auth/login", {
      title: "Admin Login - Express Delivery",
      error: req.flash("error"),
      success: req.flash("success"),
    });
  },

  showRegister: (req, res) => {
    res.render("auth/register", {
      title: "Admin Registration - Express Delivery",
      error: req.flash("error"),
    });
  },

  register: async (req, res) => {
    try {
      const {
        username,
        email,
        password,
        confirmPassword,
        firstName,
        lastName,
        phone,
        role,
      } = req.body;

      // Validation
      if (password !== confirmPassword) {
        req.flash("error", "Passwords do not match");
        return res.redirect("/auth/register");
      }

      if (password.length < 6) {
        req.flash("error", "Password must be at least 6 characters long");
        return res.redirect("/auth/register");
      }

      // Check if user already exists
      const existingAdmin = await Admin.findOne({
        $or: [{ email }, { username }],
      });

      if (existingAdmin) {
        req.flash("error", "Admin already exists with this email or username");
        return res.redirect("/auth/register");
      }

      // Create new admin
      const newAdmin = new Admin({
        username,
        email,
        password, // This will be hashed by the pre-save middleware
        role: role || "admin",
        permissions: ["manage_deliveries", "view_analytics"],
        profile: {
          firstName,
          lastName,
          phone,
        },
        isActive: true,
      });

      await newAdmin.save();

      req.flash("success", "Registration successful! Please login.");
      res.redirect("/auth/login");
    } catch (error) {
      console.error("Registration error:", error);
      req.flash("error", "Registration failed: " + error.message);
      res.redirect("/auth/register");
    }
  },

  login: (req, res, next) => {
    passport.authenticate("local", (err, admin, info) => {
      if (err) {
        console.error("Auth error:", err);
        req.flash("error", "Authentication error");
        return res.redirect("/auth/login");
      }

      if (!admin) {
        req.flash("error", info.message || "Invalid email or password");
        return res.redirect("/auth/login");
      }

      req.logIn(admin, (err) => {
        if (err) {
          console.error("Login error:", err);
          req.flash("error", "Login failed");
          return res.redirect("/auth/login");
        }

        // Set admin session
        req.session.admin = {
          id: admin._id,
          username: admin.username,
          email: admin.email,
          role: admin.role,
          permissions: admin.permissions,
          profile: admin.profile,
        };

        req.flash(
          "success",
          `Welcome back, ${admin.profile?.firstName || admin.username}!`
        );
        return res.redirect("/admin");
      });
    })(req, res, next);
  },

  logout: (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
      }
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destruction error:", err);
        }
        req.flash("success", "Logged out successfully");
        res.redirect("/auth/login");
      });
    });
  },

  // Admin-only registration (for superadmin to create other admins)
  createAdmin: async (req, res) => {
    try {
      // Check if current user is superadmin
      if (req.user.role !== "superadmin") {
        req.flash("error", "Only superadmin can create new admin accounts");
        return res.redirect("/admin");
      }

      const {
        username,
        email,
        password,
        firstName,
        lastName,
        phone,
        role,
        permissions,
      } = req.body;

      const existingAdmin = await Admin.findOne({
        $or: [{ email }, { username }],
      });

      if (existingAdmin) {
        req.flash("error", "Admin already exists with this email or username");
        return res.redirect("/admin/admins/create");
      }

      const newAdmin = new Admin({
        username,
        email,
        password,
        role: role || "admin",
        permissions: permissions || ["manage_deliveries", "view_analytics"],
        profile: {
          firstName,
          lastName,
          phone,
        },
        isActive: true,
        createdBy: req.user.id,
      });

      await newAdmin.save();

      req.flash("success", `Admin ${username} created successfully`);
      res.redirect("/admin/admins");
    } catch (error) {
      console.error("Create admin error:", error);
      req.flash("error", "Failed to create admin: " + error.message);
      res.redirect("/admin/admins/create");
    }
  },
};

module.exports = authController;
