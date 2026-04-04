const mongoose = require('mongoose')

const expenseSchema = new mongoose.Schema({
  type: {
    type: String,
    default: 'other',
  },
  category: {
    type: String,
    default: 'other',
  },
  amount: { type: Number, default: 0 },
  note: { type: String, default: '' },
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  photo: { type: String, default: '' },
  addedAt: { type: Date, default: Date.now },
})

const repairItemSchema = new mongoose.Schema({
  description: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  image: { type: String, default: '' },
  addedAt: { type: Date, default: Date.now },
})

const tripRecordSchema = new mongoose.Schema(
  {
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contract',
      required: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    transportType: {
      type: String,
      enum: ['company_trip', 'malik_trip'],
      required: true,
    },
    tripDate: { type: Date, required: true },
    fromLocation: { type: String, default: '' },
    toLocation: { type: String, default: '' },
    from: { type: String, default: '' },
    to: { type: String, default: '' },
    cargo: { type: String, default: '' },
    description: { type: String, default: '' },

    expenses: [expenseSchema],
    repairs: [repairItemSchema],

    totalExpenses: { type: Number, default: 0 },
    totalRepairs: { type: Number, default: 0 },
    approvedExpenses: { type: Number, default: 0 },
    approvedAmount: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['draft', 'active', 'submitted', 'approved', 'rejected', 'partial'],
      default: 'active',
    },
    ownerNote: { type: String, default: '' },
    submittedAt: Date,
    reviewedAt: Date,
    handledAt: Date,
    paymentRequested: {
      type: Boolean,
      default: false,
    },
    paymentRequestedAt: Date,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
)

module.exports = mongoose.model('TripRecord', tripRecordSchema)
