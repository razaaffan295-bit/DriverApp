const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: [
      "new_message",
      "application_accepted",
      "application_rejected",
      "new_application",
      "payment_received",
      "complaint_update",
      "trip_submitted",
      "trip_update",
      "payment_request",
    ],
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  link: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Notification", notificationSchema);
