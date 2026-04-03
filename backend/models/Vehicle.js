const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  vehicleType: {
    type: String,
    enum: [
      "JCB",
      "Truck",
      "Dumper",
      "Crane",
      "Excavator",
      "Roller",
      "Poclain",
      "Other",
    ],
    required: true,
  },
  vehicleNumber: { type: String },
  vehicleModel: { type: String },
  location: {
    state: { type: String },
    district: { type: String },
  },
  documents: [{ type: String }],
  assignedDriver: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Vehicle", vehicleSchema);
