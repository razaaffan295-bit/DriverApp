const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema({
  raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  againstUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
  contractId: { type: mongoose.Schema.Types.ObjectId, ref: "Contract" },
  raisedByRole: { type: String, enum: ["owner", "driver"], required: true },
  type: {
    type: String,
    enum: [
      "part_chori",
      "kaam_choda",
      "machine_damage",
      "attendance_fraud",
      "payment_nahi_diya",
      "zyada_kaam",
      "unsafe_conditions",
      "misbehavior",
      "other",
    ],
    required: true,
  },
  description: { type: String },
  evidence: [{ type: String }],
  location: {
    state: { type: String },
    district: { type: String },
  },
  status: {
    type: String,
    enum: ["pending", "under_review", "resolved", "rejected"],
    default: "pending",
  },
  adminNote: { type: String },
  adminAction: {
    type: String,
    enum: [
      "warning",
      "blocked_30days",
      "blocked_90days",
      "permanent_ban",
      "no_action",
    ],
  },
  resolvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Complaint", complaintSchema);
