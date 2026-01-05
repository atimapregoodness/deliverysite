// Make sure all models exist before importing
let Delivery, Driver, Customer, Warehouse, User;

try {
  // Try to import all models
  const models = require("../models");
  
  // Check each model individually
  Delivery = models.Delivery;
  Driver = models.Driver;
  Customer = models.Customer;
  Warehouse = models.Warehouse;
  User = models.User;
  
  // Log which models are available
  console.log("Models loaded:");
  console.log("- Delivery:", Delivery ? "Loaded" : "Not found");
  console.log("- Driver:", Driver ? "Loaded" : "Not found");
  console.log("- Customer:", Customer ? "Loaded" : "Not found");
  console.log("- Warehouse:", Warehouse ? "Loaded" : "Not found");
  console.log("- User:", User ? "Loaded" : "Not found");
  
} catch (error) {
  console.error("Error loading models:", error.message);
}

/**
 * Middleware to add document counts to res.locals for admin views
 * This makes counts available in all admin templates automatically
 */
const adminCountsMiddleware = async (req, res, next) => {
  try {
    // Only run for admin routes
    if (req.path.startsWith('/admin')) {
      
      // Prepare default counts
      const counts = {
        deliveries: { total: 0, pending: 0, completed: 0, cancelled: 0, inTransit: 0 },
        drivers: { total: 0, active: 0, available: 0, onDelivery: 0, offDuty: 0, onBreak: 0 },
        customers: { total: 0, active: 0, inactive: 0 },
        warehouses: { total: 0, withCoordinates: 0, withoutCoordinates: 0 },
        users: { total: 0, admins: 0, managers: 0, staff: 0 }
      };

      // Run count queries only if models exist
      if (Delivery) {
        counts.deliveries.total = await Delivery.countDocuments();
        counts.deliveries.pending = await Delivery.countDocuments({ status: { $in: ['pending', 'in_transit'] } });
        counts.deliveries.completed = await Delivery.countDocuments({ status: 'delivered' });
        counts.deliveries.cancelled = await Delivery.countDocuments({ status: 'cancelled' });
        counts.deliveries.inTransit = await Delivery.countDocuments({ status: 'in_transit' });
      }

      if (Driver) {
        counts.drivers.total = await Driver.countDocuments();
        counts.drivers.active = await Driver.countDocuments({ status: { $in: ['available', 'on_delivery'] } });
        counts.drivers.available = await Driver.countDocuments({ status: 'available' });
        counts.drivers.onDelivery = await Driver.countDocuments({ status: 'on_delivery' });
        counts.drivers.offDuty = await Driver.countDocuments({ status: 'off_duty' });
        counts.drivers.onBreak = await Driver.countDocuments({ status: 'break' });
      }

      if (Customer) {
        counts.customers.total = await Customer.countDocuments();
        counts.customers.active = await Customer.countDocuments({ status: 'active' });
        counts.customers.inactive = await Customer.countDocuments({ status: 'inactive' });
      }

      if (Warehouse) {
        counts.warehouses.total = await Warehouse.countDocuments();
        // Count warehouses with valid coordinates (not [0,0])
        const allWarehouses = await Warehouse.find({}, 'location');
        counts.warehouses.withCoordinates = allWarehouses.filter(w => 
          w.location && 
          w.location.coordinates && 
          w.location.coordinates[0] !== 0 && 
          w.location.coordinates[1] !== 0
        ).length;
        counts.warehouses.withoutCoordinates = counts.warehouses.total - counts.warehouses.withCoordinates;
      }

      if (User) {
        counts.users.total = await User.countDocuments();
        counts.users.admins = await User.countDocuments({ role: 'admin' });
        counts.users.managers = await User.countDocuments({ role: 'manager' });
        counts.users.staff = await User.countDocuments({ role: 'staff' });
      }

      // Add counts to res.locals
      res.locals.counts = counts;

      // Also add individual counts to res.locals for backward compatibility
      res.locals.deliveryCount = counts.deliveries.total;
      res.locals.driverCount = counts.drivers.total;
      res.locals.customerCount = counts.customers.total;
      res.locals.warehouseCount = counts.warehouses.total;
      res.locals.userCount = counts.users.total;
      
      // Add today's statistics
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      res.locals.todayStats = {
        newDeliveries: Delivery ? await Delivery.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }) : 0,
        newCustomers: Customer ? await Customer.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }) : 0,
        newDrivers: Driver ? await Driver.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }) : 0
      };

      // Add weekly statistics for trends
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      res.locals.weeklyStats = {
        deliveries: Delivery ? await Delivery.countDocuments({ createdAt: { $gte: weekAgo } }) : 0,
        revenue: 0 // You would calculate this from your order/delivery model
      };

      // Add system health indicators
      res.locals.systemHealth = {
        database: 'online',
        lastChecked: new Date(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      };
    }
  } catch (error) {
    console.error("Error in adminCountsMiddleware:", error.message);
    // Don't break the app if counts fail - just set defaults
    res.locals.counts = {
      deliveries: { total: 0, pending: 0, completed: 0, cancelled: 0, inTransit: 0 },
      drivers: { total: 0, active: 0, available: 0, onDelivery: 0, offDuty: 0, onBreak: 0 },
      customers: { total: 0, active: 0, inactive: 0 },
      warehouses: { total: 0, withCoordinates: 0, withoutCoordinates: 0 },
      users: { total: 0, admins: 0, managers: 0, staff: 0 }
    };
    res.locals.deliveryCount = 0;
    res.locals.driverCount = 0;
    res.locals.customerCount = 0;
    res.locals.warehouseCount = 0;
    res.locals.userCount = 0;
  }
  
  next();
};

/**
 * Cached version of the middleware with 30-second cache
 * This reduces database queries for frequently accessed pages
 */
const cachedAdminCountsMiddleware = (() => {
  let cache = null;
  let lastUpdated = null;
  const CACHE_DURATION = 30000; // 30 seconds in milliseconds

  return async (req, res, next) => {
    try {
      // Only run for admin routes
      if (!req.path.startsWith('/admin')) {
        return next();
      }

      const now = Date.now();
      
      // Use cache if it exists and is fresh
      if (cache && lastUpdated && (now - lastUpdated) < CACHE_DURATION) {
        Object.assign(res.locals, cache);
        return next();
      }

      // Prepare fresh data
      const counts = {
        deliveries: { total: 0 },
        drivers: { total: 0 },
        customers: { total: 0 },
        warehouses: { total: 0 },
        users: { total: 0 }
      };

      let deliveryCount = 0, driverCount = 0, customerCount = 0, warehouseCount = 0, userCount = 0;
      let todayDeliveries = 0, todayCustomers = 0, todayDrivers = 0;

      // Fetch data only if models exist
      if (Delivery) {
        deliveryCount = await Delivery.countDocuments();
        counts.deliveries.total = deliveryCount;
      }

      if (Driver) {
        driverCount = await Driver.countDocuments();
        counts.drivers.total = driverCount;
      }

      if (Customer) {
        customerCount = await Customer.countDocuments();
        counts.customers.total = customerCount;
      }

      if (Warehouse) {
        warehouseCount = await Warehouse.countDocuments();
        counts.warehouses.total = warehouseCount;
      }

      if (User) {
        userCount = await User.countDocuments();
        counts.users.total = userCount;
      }

      // Today's date for filtering
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Fetch today's stats if models exist
      if (Delivery) {
        todayDeliveries = await Delivery.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } });
      }
      
      if (Customer) {
        todayCustomers = await Customer.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } });
      }
      
      if (Driver) {
        todayDrivers = await Driver.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } });
      }

      // Prepare cache
      cache = {
        counts,
        deliveryCount,
        driverCount,
        customerCount,
        warehouseCount,
        userCount,
        todayStats: {
          newDeliveries: todayDeliveries,
          newCustomers: todayCustomers,
          newDrivers: todayDrivers
        },
        weeklyStats: {
          deliveries: Delivery ? await Delivery.countDocuments({ 
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }) : 0
        }
      };

      lastUpdated = now;

      // Set to res.locals
      Object.assign(res.locals, cache);
      
    } catch (error) {
      console.error("Error in cachedAdminCountsMiddleware:", error.message);
      // Set defaults on error
      res.locals.counts = {
        deliveries: { total: 0 },
        drivers: { total: 0 },
        customers: { total: 0 },
        warehouses: { total: 0 },
        users: { total: 0 }
      };
      res.locals.deliveryCount = 0;
      res.locals.driverCount = 0;
      res.locals.customerCount = 0;
      res.locals.warehouseCount = 0;
      res.locals.userCount = 0;
    }
    
    next();
  };
})();

/**
 * Lightweight middleware with only essential counts
 * Use this if you need minimal database queries
 */
const lightweightAdminCountsMiddleware = async (req, res, next) => {
  try {
    if (req.path.startsWith('/admin')) {
      // Prepare default counts
      let deliveryCount = 0, driverCount = 0, customerCount = 0, warehouseCount = 0;

      // Only fetch counts for existing models
      if (Delivery) deliveryCount = await Delivery.countDocuments();
      if (Driver) driverCount = await Driver.countDocuments();
      if (Customer) customerCount = await Customer.countDocuments();
      if (Warehouse) warehouseCount = await Warehouse.countDocuments();

      res.locals.deliveryCount = deliveryCount;
      res.locals.driverCount = driverCount;
      res.locals.customerCount = customerCount;
      res.locals.warehouseCount = warehouseCount;
      
      // Basic counts object for templates
      res.locals.counts = {
        deliveries: { total: deliveryCount },
        drivers: { total: driverCount },
        customers: { total: customerCount },
        warehouses: { total: warehouseCount }
      };
    }
  } catch (error) {
    console.error("Error in lightweightAdminCountsMiddleware:", error.message);
    // Set defaults
    res.locals.deliveryCount = 0;
    res.locals.driverCount = 0;
    res.locals.customerCount = 0;
    res.locals.warehouseCount = 0;
    res.locals.counts = {
      deliveries: { total: 0 },
      drivers: { total: 0 },
      customers: { total: 0 },
      warehouses: { total: 0 }
    };
  }
  
  next();
};

// Export all middleware options
module.exports = {
  adminCountsMiddleware,           // Full featured with all counts
  cachedAdminCountsMiddleware,     // Cached version (recommended for production)
  lightweightAdminCountsMiddleware // Lightweight version for minimal queries
};