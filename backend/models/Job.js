const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
  vehicleType: { type: String },
  title: { type: String },
  description: { type: String },
  location: {
    state: { type: String },
    district: { type: String },
    city: { type: String },
    address: { type: String },
  },
  vehicleCategory: {
    type: String,
    enum: ['mining', 'road', 'transport'],
    default: 'mining'
  },
  salaryType: {
    type: String,
    enum: ['daily', 'monthly', 'hourly'],
    default: 'daily'
  },
  salaryPerDay: {
    type: Number,
    default: 0
  },
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
  duration: { type: Number },
  startDate: { type: Date },
  status: { type: String, enum: ["open", "filled", "closed"], default: "open" },
  applicants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  hiredDriver: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Job", jobSchema);
