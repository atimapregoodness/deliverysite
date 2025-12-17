// middleware/validation.js

const { body, validationResult } = require("express-validator");

exports.validateDeliveryUpdate = [
  body("package.description")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Package description is required"),
  body("package.weight")
    .optional()
    .isFloat({ min: 0.1 })
    .withMessage("Weight must be a positive number"),
  body("package.value")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Value must be a positive number"),
  body("sender.email")
    .optional()
    .isEmail()
    .withMessage("Invalid email address"),
  body("sender.phone")
    .optional()
    .matches(/^[\+]?[1-9][\d\s\-\(\)\.]+$/)
    .withMessage("Invalid phone number"),
  body("receiver.email")
    .optional()
    .isEmail()
    .withMessage("Invalid email address"),
  body("receiver.phone")
    .optional()
    .matches(/^[\+]?[1-9][\d\s\-\(\)\.]+$/)
    .withMessage("Invalid phone number"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }
    next();
  },
];
