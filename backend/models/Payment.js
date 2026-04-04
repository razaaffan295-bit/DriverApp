const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
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
  amount: { type: Number },
  advanceDeduction: {
    type: Number,
    default: 0,
  },
  advanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Advance",
    default: null,
  },
  netAmount: {
    type: Number,
    default: 0,
  },
  paymentType: {
    type: String,
    enum: ["salary", "trip", "advance", "upi", "cash"],
    default: "salary",
  },
  payoutMethod: {
    type: String,
    enum: ["upi", "cash"],
    default: "upi",
  },
  utrNumber: String,
  paymentPhoto: String,
  witnessName: String,
  note: String,
  driverUpiId: String,
  driverAccountNumber: String,
  driverIfsc: String,
  driverAccountName: String,
  driverUpiQrCode: String,
  isDriverRequested: {
    type: Boolean,
    default: false,
  },
  driverRequestedAt: Date,
  month: Number,
  year: Number,
  ownerMarkedPaid: {
    type: Boolean,
    default: false,
  },
  ownerPaidAt: Date,
  driverConfirmed: {
    type: Boolean,
    default: false,
  },
  driverConfirmedAt: Date,
  driverRejected: {
    type: Boolean,
    default: false,
  },
  driverRejectionReason: String,
  status: {
    type: String,
    enum: ["pending", "paid", "rejected", "disputed"],
    default: "pending",
  },
  requestKind: {
    type: String,
    enum: ["salary", "trip"],
    default: "salary",
  },
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TripRecord",
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  }
);

module.exports = mongoose.model("Payment", paymentSchema);
