const Settings = require("../models/Settings");

const loadSettings = async (req, res, next) => {
  try {
    // Get or create singleton settings
    let appSettings = await Settings.getSettings();

    if (!appSettings) {
      // fallback default object
      appSettings = {
        domainName: "localhost:3000",
        supportEmail: "support@example.com",
        infoEmail: "info@example.com",
        adminEmail: "admin@example.com",
        phoneNumber: "",
        companyName: "My Company",
        siteTitle: "Delivery Management System",
        companyAddress: {
          street: "",
          city: "",
          state: "",
          zipCode: "",
          country: "USA",
        },
      };
    } else {
      appSettings = appSettings.toObject(); // convert Mongoose doc to plain object
    }

    // Always ensure companyAddress exists
    if (!appSettings.companyAddress) {
      appSettings.companyAddress = {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "USA",
      };
    }

    res.locals.appSettings = appSettings;

    next();
  } catch (error) {
    console.error("Error loading settings:", error);

    // Fallback object in case of error
    res.locals.appSettings = {
      domainName: "localhost:3000",
      supportEmail: "support@example.com",
      infoEmail: "info@example.com",
      adminEmail: "admin@example.com",
      phoneNumber: "",
      companyName: "My Company",
      siteTitle: "Delivery Management System",
      companyAddress: {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "USA",
      },
    };

    next();
  }
};

module.exports = { loadSettings };
