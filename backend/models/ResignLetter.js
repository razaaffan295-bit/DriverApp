const mongoose = require("mongoose");

const resignLetterSchema = new mongoose.Schema({
  contractId: { type: mongoose.Schema.Types.ObjectId, ref: "Contract", required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reason: { type: String },
  lastWorkingDate: { type: Date },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  ownerResponse: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ResignLetter", resignLetterSchema);
