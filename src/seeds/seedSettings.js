require('dotenv').config(); // Load variables from .env
const mongoose = require('mongoose');
const Settings = require('../models/Settings'); // Adjust path if needed

// Connect to MongoDB using .env variable
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

async function createDefaultSettings() {
  try {
    // Check if settings already exist
    let settings = await Settings.findOne();
    if (settings) {
      console.log('Settings already exist:', settings);
      return;
    }

    // Create default settings
    settings = await Settings.create({
      domainName: 'localhost:3000',
      supportEmail: 'support@example.com',
      infoEmail: 'info@example.com',
      adminEmail: 'admin@example.com',
      phoneNumber: '+1 (555) 123-4567',
      companyAddress: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'USA'
      },
      companyName: 'My Company',
      siteTitle: 'Delivery Management System'
    });

    console.log('Default settings created:', settings);
  } catch (err) {
    console.error('Error creating default settings:', err);
  } finally {
    mongoose.disconnect();
  }
}

createDefaultSettings();
