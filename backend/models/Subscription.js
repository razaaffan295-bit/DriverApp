const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["owner", "driver"], required: true },
  amount: { type: Number },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  startDate: { type: Date },
  endDate: { type: Date },
  status: { type: String, enum: ["active", "expired", "cancelled"], default: "active" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Subscription", subscriptionSchema);
