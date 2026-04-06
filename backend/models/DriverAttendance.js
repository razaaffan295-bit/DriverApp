const mongoose = require("mongoose");

const driverAttendanceSchema = new mongoose.Schema({
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
  date: {
    type: Date,
    required: true,
  },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  status: {
    type: String,
    enum: ["present", "absent", "half_day"],
    required: true,
  },
  hoursWorked: {
    type: Number,
    default: 0,
  },
  note: {
    type: String,
    default: "",
  },
  salaryForDay: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

driverAttendanceSchema.index(
  { contractId: 1, driverId: 1, date: 1 },
  { unique: true }
);

module.exports = mongoose.model("DriverAttendance", driverAttendanceSchema);

