const mongoose = require('mongoose')

const driverInviteSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    default: null,
  },
  driverPhone: {
    type: String,
    required: true,
  },

  // Salary details
  vehicleCategory: {
    type: String,
    enum: ['mining', 'road', 'transport'],
    required: true,
  },
  salaryType: {
    type: String,
    enum: ['daily', 'monthly', 'hourly'],
    required: true,
  },
  salaryPerDay: {
    type: Number,
    default: 0,
  },
  salaryPerMonth: {
    type: Number,
    default: 0,
  },
  salaryPerHour: {
    type: Number,
    default: 0,
  },
  dailyBhatta: {
    type: Number,
    default: 0,
  },
  hasBhatta: {
    type: Boolean,
    default: false,
  },
  hasHourlyBonus: {
    type: Boolean,
    default: false,
  },
  transportType: {
    type: String,
    enum: ['company_trip', 'malik_trip', 'none'],
    default: 'none',
  },
  duration: {
    type: Number,
    default: 30,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  terms: {
    type: String,
    default: '',
  },
  safetyConditions: {
    type: String,
    default: '',
  },
  workLocation: {
    type: String,
    default: '',
  },

  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 7,
    // Auto expire after 7 days
  },
})

module.exports = mongoose.model('DriverInvite', driverInviteSchema)

