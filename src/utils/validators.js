import Joi from "joi";

/**
 * Custom Joi validators for delivery tracking system
 */
class Validators {
  /**
   * MongoDB ObjectId validator
   */
  static objectId() {
    return Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .message("Invalid ID format");
  }

  /**
   * Email validator
   */
  static email() {
    return Joi.string().email().lowercase().trim().max(255);
  }

  /**
   * Phone number validator
   */
  static phone() {
    return Joi.string()
      .pattern(/^\+?[\d\s\-\(\)]{10,}$/)
      .message("Invalid phone number format");
  }

  /**
   * Password validator
   */
  static password() {
    return Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .message(
        "Password must contain at least one lowercase letter, one uppercase letter, and one number"
      );
  }

  /**
   * Coordinates validator
   */
  static coordinates() {
    return Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
    });
  }

  /**
   * Tracking code validator
   */
  static trackingCode() {
    return Joi.string()
      .pattern(/^(TRK|DLV)-[A-Z0-9]+$/)
      .message("Invalid tracking code format");
  }

  /**
   * Delivery ID validator
   */
  static deliveryId() {
    return Joi.string()
      .pattern(/^DLV-[A-Z0-9\-]+$/)
      .message("Invalid delivery ID format");
  }

  /**
   * User registration validator
   */
  static userRegistration() {
    return Joi.object({
      username: Joi.string().alphanum().min(3).max(30).required(),
      email: this.email().required(),
      password: this.password().required(),
      profile: Joi.object({
        firstName: Joi.string().max(50).required(),
        lastName: Joi.string().max(50).required(),
        phone: this.phone().required(),
      }).required(),
      role: Joi.string().valid("user", "admin", "driver").default("user"),
    });
  }

  /**
   * User login validator
   */
  static userLogin() {
    return Joi.object({
      email: this.email().required(),
      password: Joi.string().required(),
    });
  }

  /**
   * User update validator
   */
  static userUpdate() {
    return Joi.object({
      username: Joi.string().alphanum().min(3).max(30),
      email: this.email(),
      profile: Joi.object({
        firstName: Joi.string().max(50),
        lastName: Joi.string().max(50),
        phone: this.phone(),
        avatar: Joi.object({
          public_id: Joi.string(),
          url: Joi.string().uri(),
        }),
      }),
      isActive: Joi.boolean(),
    }).min(1); // At least one field required
  }

  /**
   * Delivery creation validator
   */
  static deliveryCreation() {
    return Joi.object({
      recipient: Joi.object({
        name: Joi.string().max(100).required(),
        email: this.email().required(),
        phone: this.phone().required(),
        address: Joi.object({
          street: Joi.string().max(255).required(),
          city: Joi.string().max(100).required(),
          state: Joi.string().max(100).required(),
          country: Joi.string().max(100).required(),
          postalCode: Joi.string().max(20).required(),
          coordinates: this.coordinates().optional(),
        }).required(),
      }).required(),

      package: Joi.object({
        description: Joi.string().max(500).required(),
        weight: Joi.number().min(0.1).max(1000).required(), // in kg
        dimensions: Joi.object({
          length: Joi.number().min(1).max(500).required(), // in cm
          width: Joi.number().min(1).max(500).required(), // in cm
          height: Joi.number().min(1).max(500).required(), // in cm
        }).required(),
        value: Joi.number().min(0).max(1000000).default(0), // in currency
        images: Joi.array()
          .items(
            Joi.object({
              public_id: Joi.string(),
              url: Joi.string().uri(),
            })
          )
          .max(5),
      }).required(),

      estimatedDelivery: Joi.date().greater("now").required(),
      driver: this.objectId().optional(),

      route: Joi.array()
        .items(
          Joi.object({
            sequence: Joi.number().min(1).required(),
            location: Joi.object({
              name: Joi.string().max(100).required(),
              coordinates: this.coordinates().required(),
            }).required(),
            estimatedArrival: Joi.date().required(),
            completed: Joi.boolean().default(false),
          })
        )
        .optional(),
    });
  }

  /**
   * Delivery update validator
   */
  static deliveryUpdate() {
    return Joi.object({
      recipient: Joi.object({
        name: Joi.string().max(100),
        email: this.email(),
        phone: this.phone(),
        address: Joi.object({
          street: Joi.string().max(255),
          city: Joi.string().max(100),
          state: Joi.string().max(100),
          country: Joi.string().max(100),
          postalCode: Joi.string().max(20),
          coordinates: this.coordinates().optional(),
        }),
      }),

      package: Joi.object({
        description: Joi.string().max(500),
        weight: Joi.number().min(0.1).max(1000),
        dimensions: Joi.object({
          length: Joi.number().min(1).max(500),
          width: Joi.number().min(1).max(500),
          height: Joi.number().min(1).max(500),
        }),
        value: Joi.number().min(0).max(1000000),
        images: Joi.array()
          .items(
            Joi.object({
              public_id: Joi.string(),
              url: Joi.string().uri(),
            })
          )
          .max(5),
      }),

      estimatedDelivery: Joi.date().greater("now"),
      driver: this.objectId(),
      currentStatus: Joi.string().valid(
        "created",
        "processing",
        "shipped",
        "in-transit",
        "out-for-delivery",
        "delivered",
        "delayed",
        "cancelled"
      ),
    }).min(1); // At least one field required
  }

  /**
   * Location update validator
   */
  static locationUpdate() {
    return Joi.object({
      deliveryId: this.deliveryId().required(),
      coordinates: this.coordinates().required(),
      address: Joi.string().max(255).optional(),
      speed: Joi.number().min(0).max(200).optional(), // km/h
      batteryLevel: Joi.number().min(0).max(100).optional(), // percentage
      signalStrength: Joi.number().min(0).max(100).optional(), // percentage
    });
  }

  /**
   * Status update validator
   */
  static statusUpdate() {
    return Joi.object({
      status: Joi.string()
        .valid(
          "created",
          "processing",
          "shipped",
          "in-transit",
          "out-for-delivery",
          "delivered",
          "delayed",
          "cancelled"
        )
        .required(),
      description: Joi.string().max(500).optional(),
      location: Joi.object({
        name: Joi.string().max(100).optional(),
        coordinates: this.coordinates().optional(),
      }).optional(),
    });
  }

  /**
   * Breakdown report validator
   */
  static breakdownReport() {
    return Joi.object({
      type: Joi.string()
        .valid("mechanical", "traffic", "weather", "accident", "other")
        .required(),
      description: Joi.string().max(1000).required(),
      location: Joi.object({
        name: Joi.string().max(100).required(),
        coordinates: this.coordinates().required(),
      }).required(),
      severity: Joi.string()
        .valid("low", "medium", "high", "critical")
        .default("medium"),
      estimatedResolutionTime: Joi.number().min(0).optional(), // in minutes
    });
  }

  /**
   * Driver assignment validator
   */
  static driverAssignment() {
    return Joi.object({
      driverId: this.objectId().required(),
      deliveryIds: Joi.array().items(this.deliveryId()).min(1).required(),
    });
  }

  /**
   * Pagination validator
   */
  static pagination() {
    return Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      sort: Joi.string().default("-createdAt"),
      search: Joi.string().max(100).optional(),
      status: Joi.string().optional(),
      startDate: Joi.date().optional(),
      endDate: Joi.date().optional(),
    });
  }

  /**
   * File upload validator
   */
  static fileUpload() {
    return Joi.object({
      fieldname: Joi.string().required(),
      originalname: Joi.string().required(),
      encoding: Joi.string().required(),
      mimetype: Joi.string()
        .valid(
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "application/pdf"
        )
        .required(),
      size: Joi.number()
        .max(5 * 1024 * 1024)
        .required(), // 5MB max
      destination: Joi.string().optional(),
      filename: Joi.string().required(),
      path: Joi.string().optional(),
    });
  }

  /**
   * Notification settings validator
   */
  static notificationSettings() {
    return Joi.object({
      email: Joi.boolean().default(true),
      push: Joi.boolean().default(true),
      sms: Joi.boolean().default(false),
      breakdownAlerts: Joi.boolean().default(true),
      statusUpdates: Joi.boolean().default(true),
      deliveryConfirmation: Joi.boolean().default(true),
    });
  }

  /**
   * System settings validator
   */
  static systemSettings() {
    return Joi.object({
      notifications: this.notificationSettings(),
      delivery: Joi.object({
        defaultEstimatedDays: Joi.number().min(1).max(30).default(3),
        autoAssignDrivers: Joi.boolean().default(false),
        requireSignature: Joi.boolean().default(true),
        maxPackageWeight: Joi.number().min(1).max(1000).default(100),
        maxPackageValue: Joi.number().min(0).max(1000000).default(5000),
      }),
      map: Joi.object({
        defaultZoom: Joi.number().min(1).max(20).default(12),
        refreshInterval: Joi.number().min(5).max(300).default(30),
        showTraffic: Joi.boolean().default(true),
        showWeather: Joi.boolean().default(false),
      }),
      security: Joi.object({
        maxLoginAttempts: Joi.number().min(1).max(10).default(5),
        sessionTimeout: Joi.number().min(5).max(1440).default(60), // minutes
        require2FA: Joi.boolean().default(false),
      }),
    });
  }

  /**
   * Bulk operation validator
   */
  static bulkOperation() {
    return Joi.object({
      deliveryIds: Joi.array()
        .items(this.deliveryId())
        .min(1)
        .max(100)
        .required(),
      operation: Joi.string()
        .valid("status-update", "assign-driver", "delete", "export")
        .required(),
      data: Joi.object().optional(), // Operation-specific data
    });
  }

  /**
   * Export data validator
   */
  static exportData() {
    return Joi.object({
      format: Joi.string().valid("csv", "json", "pdf").default("csv"),
      startDate: Joi.date().optional(),
      endDate: Joi.date().optional(),
      status: Joi.string().optional(),
      fields: Joi.array().items(Joi.string()).optional(),
    });
  }

  /**
   * Analytics query validator
   */
  static analyticsQuery() {
    return Joi.object({
      period: Joi.string()
        .valid("day", "week", "month", "quarter", "year")
        .default("month"),
      startDate: Joi.date().optional(),
      endDate: Joi.date().optional(),
      metrics: Joi.array()
        .items(
          Joi.string().valid(
            "delivery-count",
            "delivery-time",
            "breakdowns",
            "on-time-rate"
          )
        )
        .default(["delivery-count"]),
      groupBy: Joi.string()
        .valid("day", "week", "month", "driver", "status")
        .default("day"),
    });
  }

  /**
   * Validate data against schema
   */
  static validate(data, schema, options = {}) {
    const defaultOptions = {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true,
    };

    const validationOptions = { ...defaultOptions, ...options };
    const { error, value } = schema.validate(data, validationOptions);

    if (error) {
      const validationError = new Error("Validation failed");
      validationError.details = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        type: detail.type,
      }));
      throw validationError;
    }

    return value;
  }

  /**
   * Async validation wrapper
   */
  static async validateAsync(data, schema, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const result = this.validate(data, schema, options);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Create custom validator for specific fields
   */
  static createFieldValidator(fieldName, schema) {
    return (value) => {
      try {
        this.validate(value, schema);
        return { isValid: true, error: null };
      } catch (error) {
        return {
          isValid: false,
          error: error.details[0]?.message || `Invalid ${fieldName}`,
        };
      }
    };
  }

  /**
   * Sanitize input data
   */
  static sanitizeInput(data, schema) {
    try {
      return this.validate(data, schema, { stripUnknown: true });
    } catch (error) {
      // If validation fails, still try to sanitize what we can
      const { value } = schema.validate(data, {
        stripUnknown: true,
        abortEarly: false,
      });
      return value;
    }
  }
}

export default Validators;

// Export commonly used schemas for convenience
export const Schemas = {
  user: {
    registration: Validators.userRegistration(),
    login: Validators.userLogin(),
    update: Validators.userUpdate(),
  },
  delivery: {
    create: Validators.deliveryCreation(),
    update: Validators.deliveryUpdate(),
    status: Validators.statusUpdate(),
    location: Validators.locationUpdate(),
    breakdown: Validators.breakdownReport(),
  },
  system: {
    pagination: Validators.pagination(),
    settings: Validators.systemSettings(),
    analytics: Validators.analyticsQuery(),
    export: Validators.exportData(),
    bulk: Validators.bulkOperation(),
  },
};
