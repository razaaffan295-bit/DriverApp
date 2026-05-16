const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Job",
    required: false,
    default: null,
  },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

messageSchema.index({ senderId: 1, receiverId: 1 })
messageSchema.index({ receiverId: 1, isRead: 1 })
messageSchema.index({ jobId: 1 })
messageSchema.index({ createdAt: -1 })

module.exports = mongoose.model("Message", messageSchema);
