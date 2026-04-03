const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["owner", "driver", "admin"], required: true },
  location: {
    state: { type: String, required: true },
    district: { type: String, required: true },
  },
  profilePhoto: { type: String },
  isVerified: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false },
  blockReason: { type: String, default: "" },
  blockedAt: { type: Date },
  blockUntil: { type: Date },
  subscription: {
    isActive: { type: Boolean, default: false },
    startDate: { type: Date },
    endDate: { type: Date },
    razorpaySubscriptionId: { type: String },
    razorpayPaymentId: { type: String },
  },
  createdAt: { type: Date, default: Date.now },
});

userSchema.index({ "location.state": 1 });
userSchema.index({ role: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ isBlocked: 1 });

module.exports = mongoose.model("User", userSchema);
