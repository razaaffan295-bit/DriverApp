const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  coverMessage: { type: String },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "active", "terminated"],
    default: "pending",
  },
  appliedAt: { type: Date, default: Date.now },
});

applicationSchema.index({ driverId: 1, status: 1 })
applicationSchema.index({ jobId: 1, status: 1 })
applicationSchema.index({ ownerId: 1 })
applicationSchema.index({ createdAt: -1 })

module.exports = mongoose.model("Application", applicationSchema);
