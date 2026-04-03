const mongoose = require('mongoose')

const repairRequestSchema =
  new mongoose.Schema({
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contract',
      required: true
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    description: {
      type: String, required: true
    },
    amount: {
      type: Number, required: true
    },
    photo: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    ownerNote: { type: String, default: '' },
    reviewedAt: Date,
    createdAt: {
      type: Date, default: Date.now
    }
  })

module.exports = mongoose.model(
  'RepairRequest', repairRequestSchema
)
