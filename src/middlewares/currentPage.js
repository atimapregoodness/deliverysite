// middleware/currentPage.js
const setCurrentPage = (req, res, next) => {
  const path = req.path;

  // Remove leading and trailing slashes
  const cleanPath = path.replace(/^\/|\/$/g, "");

  // Set currentPage based on your test results
  let currentPage = "home";

  if (path === "/" || path === "") {
    currentPage = "home";
  } else if (path.startsWith("/track") && !path.startsWith("/delivery/track")) {
    currentPage = "track";
  } else if (path.startsWith("/delivery/track")) {
    currentPage = "delivery/track";
  } else if (path.startsWith("/security")) {
    currentPage = "security";
  } else if (path.startsWith("/logistics")) {
    currentPage = "logistics";
  } else if (
    path.startsWith("/company") ||
    path === "/about" ||
    path === "/contact"
  ) {
    currentPage = "company";
  } else if (cleanPath) {
    // Fallback: use the first path segment
    currentPage = cleanPath.split("/")[0];
  }

  // Add to locals
  res.locals.currentPage = currentPage;
  res.locals.fullPath = cleanPath;

  next();
};

module.exports = setCurrentPage;
