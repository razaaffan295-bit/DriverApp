const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema({
  ratedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  ratedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
  contractId: { type: mongoose.Schema.Types.ObjectId, ref: "Contract" },
  score: { type: Number },
  review: { type: String },
  ratedByRole: { type: String, enum: ["owner", "driver"], required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Rating", ratingSchema);
