const mongoose = require("mongoose");

const ownerProfileSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true },
  profilePhoto: { type: String, default: "" },
  companyName: { type: String },
  about: { type: String },
  totalVehicles: { type: Number },
  documents: [{ type: String }],
  isProfileComplete: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("OwnerProfile", ownerProfileSchema);
