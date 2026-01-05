const mongoose = require('mongoose');

const companyAddressSchema = new mongoose.Schema({
  street: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  zipCode: { type: String, default: '' },
  country: { type: String, default: 'USA' }
}, { _id: false }); // no separate _id for subdocument

const settingsSchema = new mongoose.Schema({
  domainName: { type: String, trim: true, default: 'localhost:3000' },
  supportEmail: { type: String, trim: true, lowercase: true, default: 'support@example.com' },
  infoEmail: { type: String, trim: true, lowercase: true, default: 'info@example.com' },
  adminEmail: { type: String, trim: true, lowercase: true, required: true, default: 'admin@example.com' },
  phoneNumber: { type: String, trim: true, default: '' },
  companyAddress: { type: companyAddressSchema, default: () => ({}) },
  companyName: { type: String, default: 'My Company' },
  siteTitle: { type: String, default: 'Delivery Management System' }
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

/**
 * Singleton pattern: always return the single settings document.
 * If none exists, create one with defaults.
 */
settingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

/**
 * Update settings safely.
 * Only allow updates to defined fields.
 * Handles companyAddress if provided as a stringified JSON.
 */
settingsSchema.statics.updateSettings = async function(data) {
  const settings = await this.getSettings();

  const allowedFields = [
    'domainName', 'supportEmail', 'infoEmail', 'adminEmail',
    'phoneNumber', 'companyAddress', 'companyName', 'siteTitle'
  ];

  allowedFields.forEach(field => {
    if (data[field] !== undefined) {
      if (field === 'companyAddress' && typeof data[field] === 'string') {
        try {
          settings[field] = JSON.parse(data[field]);
        } catch {
          // keep as string if parsing fails
          settings[field] = data[field];
        }
      } else {
        settings[field] = data[field];
      }
    }
  });

  await settings.save();
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
