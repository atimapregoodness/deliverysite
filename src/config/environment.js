// config/environment.js
import dotenv from "dotenv";
dotenv.config();

/**
 * Helper: convert string env vars to boolean
 */
const bool = (v) => String(v).toLowerCase() === "true";

/**
 * Base configuration (shared across all environments)
 */
const baseConfig = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",

  app: {
    name: process.env.APP_NAME || "DeliveryApp",
    supportEmail: process.env.SUPPORT_EMAIL || "support@deliveryapp.com",
    supportPhone: process.env.SUPPORT_PHONE || "+1234567890",
  },

  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/delivery_app",
    options: {
      maxPoolSize: 20,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    },
  },

  jwt: {
    secret: process.env.JWT_SECRET || "delivery_app_secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },

  session: {
    secret:
      process.env.SESSION_SECRET ||
      process.env.JWT_SECRET ||
      "delivery_app_session_secret",
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  },

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || null,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || null,
    region: process.env.AWS_REGION || "us-east-1",
    bucketName: process.env.AWS_BUCKET_NAME || "delivery-app-images",
    cloudfrontUrl: process.env.AWS_CLOUDFRONT_URL || null,
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || null,
    publicKey: process.env.STRIPE_PUBLIC_KEY || null,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
  },

  email: {
    host: process.env.EMAIL_HOST || null,
    port: Number(process.env.EMAIL_PORT) || 587,
    user: process.env.EMAIL_USER || null,
    pass: process.env.EMAIL_PASS || null,
    from: process.env.FROM_EMAIL || "noreply@deliveryapp.com",
    fromName: process.env.FROM_NAME || "Delivery App",
  },

  sms: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || null,
    authToken: process.env.TWILIO_AUTH_TOKEN || null,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || null,
  },

  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    password: process.env.REDIS_PASSWORD || null,
  },

  maps: {
    google: { apiKey: process.env.GOOGLE_MAPS_API_KEY || null },
    mapbox: { accessToken: process.env.MAPBOX_ACCESS_TOKEN || null },
  },

  features: {
    enableEmailVerification: bool(process.env.ENABLE_EMAIL_VERIFICATION),
    enableSmsVerification: bool(process.env.ENABLE_SMS_VERIFICATION),
    enablePushNotifications: bool(process.env.ENABLE_PUSH_NOTIFICATIONS),
    enableSwagger: bool(process.env.ENABLE_SWAGGER),
  },

  delivery: {
    radiusKm: Number(process.env.DELIVERY_RADIUS_KM) || 20,
    baseFee: Number(process.env.BASE_DELIVERY_FEE) || 5.0,
    feePerKm: Number(process.env.DELIVERY_FEE_PER_KM) || 0.5,
    minimumOrder: Number(process.env.MINIMUM_ORDER_AMOUNT) || 10.0,
    taxPercentage: Number(process.env.TAX_PERCENTAGE) || 7.5,
  },

  upload: {
    limit: process.env.UPLOAD_LIMIT || "50mb",
    maxFileSize: Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
  },

  debug: bool(process.env.DEBUG),
  logLevel: process.env.LOG_LEVEL || "info",
};

/**
 * Environment-specific overrides
 */
const environmentOverrides = {
  development: {
    mongodb: {
      uri:
        process.env.MONGODB_URI || "mongodb://localhost:27017/delivery_app_dev",
    },
    debug: true,
    logLevel: "debug",
    session: {
      cookie: {
        secure: false,
        sameSite: "lax",
      },
    },
  },

  testing: {
    mongodb: {
      uri:
        process.env.MONGODB_URI ||
        "mongodb://localhost:27017/delivery_app_test",
    },
    debug: false,
    logLevel: "warn",
  },

  production: {
    mongodb: {
      uri: process.env.MONGODB_URI, // MUST be provided
      options: {
        maxPoolSize: 100,
        minPoolSize: 10,
        socketTimeoutMS: 60000,
      },
    },
    session: {
      cookie: {
        secure: true,
        sameSite: "none",
      },
    },
    debug: false,
    logLevel: "warn",
  },
};

/**
 * Merge base + env overrides
 */
const env = baseConfig.nodeEnv;
const mergedConfig = {
  ...baseConfig,
  ...(environmentOverrides[env] || {}),
  mongodb: {
    ...baseConfig.mongodb,
    ...(environmentOverrides[env]?.mongodb || {}),
    options: {
      ...baseConfig.mongodb.options,
      ...(environmentOverrides[env]?.mongodb?.options || {}),
    },
  },
  session: {
    ...baseConfig.session,
    ...(environmentOverrides[env]?.session || {}),
    cookie: {
      ...baseConfig.session.cookie,
      ...(environmentOverrides[env]?.session?.cookie || {}),
    },
  },
};

export default mergedConfig;
