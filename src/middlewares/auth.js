// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated() && req.session.admin) {
    return next();
  }
  req.flash("error", "Please login to access this page");
  res.redirect("/auth/login");
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (
    req.isAuthenticated() &&
    req.session.admin &&
    (req.session.admin.role === "admin" ||
      req.session.admin.role === "superadmin")
  ) {
    return next();
  }
  req.flash("error", "Admin access required");
  res.redirect("/auth/login");
};

// Middleware to check if user is superadmin
const isSuperAdmin = (req, res, next) => {
  if (
    req.isAuthenticated() &&
    req.session.admin &&
    req.session.admin.role === "superadmin"
  ) {
    return next();
  }
  req.flash("error", "Superadmin access required");
  res.redirect("/admin");
};

// Middleware to check specific permissions
const hasPermission = (permission) => {
  return (req, res, next) => {
    if (
      req.isAuthenticated() &&
      req.session.admin &&
      (req.session.admin.role === "superadmin" ||
        req.session.admin.permissions.includes(permission))
    ) {
      return next();
    }
    req.flash("error", "Insufficient permissions");
    res.redirect("/admin");
  };
};

module.exports = {
  isAuthenticated,
  isAdmin,
  isSuperAdmin,
  hasPermission,
};
