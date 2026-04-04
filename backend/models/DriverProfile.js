const mongoose = require("mongoose");

const driverProfileSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true },
  skills: [
    {
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
    },
  ],
  experience: { type: Number },
  licenseNumber: { type: String },
  licenseType: { type: String, enum: ["HMV", "LMV", "Both"] },
  licenseExpiry: { type: Date },
  about: { type: String },
  documents: {
    license: { type: String, default: "" },
    aadhar: { type: String, default: "" },
    photo: { type: String, default: "" },
    other: { type: String, default: "" },
  },
  bankDetails: {
    accountName: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String },
    upiId: { type: String },
    upiQrCode: { type: String },
  },
  isProfileComplete: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("DriverProfile", driverProfileSchema);
