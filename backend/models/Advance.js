const mongoose = require("mongoose");

const advanceSchema = new mongoose.Schema({
  contractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Contract",
    required: true,
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  requestedAmount: {
    type: Number,
    required: true,
  },
  approvedAmount: {
    type: Number,
    default: 0,
  },
  reason: {
    type: String,
    default: "",
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "partial"],
    default: "pending",
  },
  paymentType: {
    type: String,
    enum: ["upi", "cash"],
    default: "cash",
  },
  utrNumber: String,
  paymentPhoto: String,
  witnessName: String,
  note: String,
  totalRepaid: {
    type: Number,
    default: 0,
  },
  remaining: {
    type: Number,
    default: 0,
  },
  isCleared: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Advance", advanceSchema);
