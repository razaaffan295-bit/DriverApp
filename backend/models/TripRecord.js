const mongoose = require('mongoose')

const expenseSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['diesel', 'toll', 'police', 'khana', 'repair', 'other'],
    required: true
  },
  amount: { type: Number, required: true },
  description: { type: String, default: '' },
  photo: { type: String, default: '' }
})

const tripRecordSchema = new mongoose.Schema({
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
  transportType: {
    type: String,
    enum: ['company_trip', 'malik_trip'],
    required: true
  },
  tripDate: { type: Date, required: true },
  fromLocation: { type: String, default: '' },
  toLocation: { type: String, default: '' },
  description: { type: String, default: '' },

  expenses: [expenseSchema],
  totalExpenses: { type: Number, default: 0 },
  approvedExpenses: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved', 'rejected', 'partial'],
    default: 'draft'
  },
  ownerNote: { type: String, default: '' },
  submittedAt: Date,
  reviewedAt: Date,
  createdAt: {
    type: Date, default: Date.now
  }
})

module.exports = mongoose.model(
  'TripRecord', tripRecordSchema
)
