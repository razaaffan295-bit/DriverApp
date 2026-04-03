const mongoose = require("mongoose");

const contractSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  terms: { type: String },
  safetyConditions: { type: String },
  vehicleCategory: {
    type: String,
    enum: ['mining', 'road', 'transport'],
    default: 'mining'
  },
  salaryType: {
    type: String,
    enum: ['daily', 'monthly', 'hourly'],
    default: 'monthly'
  },
  salaryPerDay: { type: Number },
  salaryPerMonth: {
    type: Number,
    default: 0
  },
  salaryPerHour: {
    type: Number,
    default: 0
  },
  dailyBhatta: {
    type: Number,
    default: 0
  },
  hasBhatta: {
    type: Boolean,
    default: false
  },
  hasHourlyBonus: {
    type: Boolean,
    default: false
  },
  transportType: {
    type: String,
    enum: ['company_trip', 'malik_trip', 'none'],
    default: 'none'
  },
  startDate: { type: Date },
  duration: { type: Number },
  workLocation: { type: String },
  ownerSignature: { type: String },
  driverSignature: { type: String },
  status: {
    type: String,
    enum: ["sent", "signed", "active", "completed", "terminated"],
    default: "sent",
  },
  driverSigned: { type: Boolean, default: false },
  driverSignedAt: { type: Date },
  pdfUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Contract", contractSchema);
