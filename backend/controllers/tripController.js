const mongoose = require('mongoose')
const TripRecord = require('../models/TripRecord')
const Contract = require('../models/Contract')
const Notification = require('../models/Notification')
const RepairRequest = require('../models/RepairRequest')

// Constants
const ACTIVE_STATUSES = ['draft', 'active']
const ALLOWED_EXPENSE_TYPES = new Set([
  'diesel', 'toll', 'police', 'khana', 'repair', 'other',
])
const ALLOWED_REVIEW_ACTIONS = ['approved', 'rejected']
const MAX_DESCRIPTION_LENGTH = 1000
const MAX_NOTE_LENGTH = 500
const MAX_LOCATION_LENGTH = 200
const MAX_AMOUNT = 1000000

const tripUid = (req) => req.user._id || req.user.id

// Helpers
const sendServerError = (res) => {
  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Server error'
      : undefined,
  })
}

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(String(id || ''))
}

const createNotificationSafe = (data) => {
  Notification.create(data).catch(() => {
    // Silent fail - non-blocking
  })
}

const recalcExpenseTotal = (trip) =>
  (trip.expenses || []).reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0
  )

const recalcRepairTotal = (trip) =>
  (trip.repairs || []).reduce(
    (sum, r) => sum + (Number(r.amount) || 0),
    0
  )

const normalizeExpenseType = (body) => {
  const raw = body.type || body.category || 'other'
  return ALLOWED_EXPENSE_TYPES.has(String(raw)) ? String(raw) : 'other'
}

const createTrip = async (req, res) => {
  try {
    const {
      tripDate,
      fromLocation,
      toLocation,
      from,
      to,
      cargo,
      description,
    } = req.body

    const uid = tripUid(req)

    const contract = await Contract.findOne({
      driverId: uid,
      status: 'active',
      vehicleCategory: 'transport',
    }).lean()

    if (!contract) {
      return res.status(400).json({
        success: false,
        message: 'Koi active transport contract nahi',
      })
    }

    const openTrip = await TripRecord.findOne({
      contractId: contract._id,
      driverId: uid,
      status: { $in: ACTIVE_STATUSES },
    }).select('_id').lean()

    if (openTrip) {
      return res.status(400).json({
        success: false,
        message: 'Pehle se ek active trip hai — use complete karein',
      })
    }

    // Sanitize + length limits
    const fromVal = String(fromLocation || from || '').slice(0, MAX_LOCATION_LENGTH)
    const toVal = String(toLocation || to || '').slice(0, MAX_LOCATION_LENGTH)
    const cargoVal = String(cargo || '').slice(0, MAX_LOCATION_LENGTH)
    const descVal = String(description || cargoVal || '').slice(0, MAX_DESCRIPTION_LENGTH)

    const trip = await TripRecord.create({
      contractId: contract._id,
      driverId: uid,
      ownerId: contract.ownerId,
      transportType: contract.transportType,
      tripDate: new Date(tripDate || Date.now()),
      fromLocation: fromVal,
      toLocation: toVal,
      from: fromVal,
      to: toVal,
      cargo: cargoVal,
      description: descVal,
      expenses: [],
      repairs: [],
      totalExpenses: 0,
      totalRepairs: 0,
      status: 'active',
    })

    res.json({
      success: true,
      trip,
      message: 'Trip start ho gaya!',
    })
  } catch (error) {
    return sendServerError(res)
  }
}

const addExpense = async (req, res) => {
  try {
    const { tripId, amount, note, image, photo, description } = req.body
    const uid = tripUid(req)

    if (!isValidObjectId(tripId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid trip ID',
      })
    }

    const amtNum = Number(amount) || 0
    if (amtNum < 0 || amtNum > MAX_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: 'Amount valid honi chahiye',
      })
    }

    const trip = await TripRecord.findOne({
      _id: tripId,
      driverId: uid,
      status: { $in: ACTIVE_STATUSES },
    })

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Active trip nahi mili',
      })
    }

    if (trip.transportType !== 'malik_trip') {
      return res.status(400).json({
        success: false,
        message: 'Company trip mein expense nahi hota',
      })
    }

    const expType = normalizeExpenseType(req.body)
    const noteVal =
      note != null && note !== ''
        ? String(note)
        : description != null
          ? String(description)
          : ''
    let uploadUrl = ''
    if (req.file) {
      uploadUrl =
        req.file.path || req.file.secure_url || req.file.url || ''
    }
    const imgVal = uploadUrl || image || photo || ''

    const noteTrim = String(noteVal).slice(0, MAX_NOTE_LENGTH)
    trip.expenses.push({
      type: expType,
      category: expType,
      amount: amtNum,
      note: noteTrim,
      description: noteTrim,
      image: imgVal,
      photo: imgVal,
      addedAt: new Date(),
    })

    trip.totalExpenses = recalcExpenseTotal(trip)
    await trip.save()

    res.json({
      success: true,
      message: 'Expense add ho gaya',
      trip,
    })
  } catch (error) {
    return sendServerError(res)
  }
}

const addRepair = async (req, res) => {
  try {
    const { tripId, description, amount, image } = req.body
    const uid = tripUid(req)

    if (!isValidObjectId(tripId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid trip ID',
      })
    }

    const amtNum = Number(amount) || 0
    if (amtNum < 0 || amtNum > MAX_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: 'Amount valid honi chahiye',
      })
    }

    const trip = await TripRecord.findOne({
      _id: tripId,
      driverId: uid,
      status: { $in: ACTIVE_STATUSES },
    })

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Active trip nahi mili',
      })
    }

    let imageUrl = ''
    if (req.file) {
      imageUrl =
        req.file.path || req.file.secure_url || req.file.url || ''
    }

    trip.repairs = trip.repairs || []
    trip.repairs.push({
      description: String(description ?? '').slice(0, MAX_DESCRIPTION_LENGTH),
      amount: amtNum,
      image: imageUrl || image || '',
      addedAt: new Date(),
    })
    trip.totalRepairs = recalcRepairTotal(trip)
    await trip.save()

    res.json({
      success: true,
      message: 'Repair record add ho gaya',
      trip,
    })
  } catch (error) {
    return sendServerError(res)
  }
}

const completeTrip = async (req, res) => {
  try {
    const { tripId } = req.body
    const uid = tripUid(req)

    if (!isValidObjectId(tripId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid trip ID',
      })
    }

    const trip = await TripRecord.findOne({
      _id: tripId,
      driverId: uid,
      status: { $in: ACTIVE_STATUSES },
    })
      .populate('driverId', 'name')
      .populate('contractId')

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip nahi mili',
      })
    }

    const totalExpenses = recalcExpenseTotal(trip)
    const totalRepairs = recalcRepairTotal(trip)
    trip.totalExpenses = totalExpenses
    trip.totalRepairs = totalRepairs
    trip.status = 'submitted'
    trip.submittedAt = new Date()
    await trip.save()

    // Use already-populated contract from trip (avoid extra query)
    const ownerRef = trip.contractId?.ownerId || trip.ownerId
    const fromLabel = trip.fromLocation || trip.from || '—'
    const toLabel = trip.toLocation || trip.to || '—'

    if (ownerRef) {
      // Non-blocking notification
      createNotificationSafe({
        userId: ownerRef,
        title: 'Trip Submitted',
        message: `${trip.driverId?.name || 'Driver'} submitted a trip. ${fromLabel} → ${toLabel}. Total expense: ₹${totalExpenses}`,
        type: 'trip_submitted',
        link: '/owner/trips',
        isRead: false,
      })
    }

    res.json({
      success: true,
      message: 'Trip submit ho gayi! Owner review karega.',
      trip,
    })
  } catch (error) {
    return sendServerError(res)
  }
}

const getActiveTrip = async (req, res) => {
  try {
    const uid = tripUid(req)

    const trip = await TripRecord.findOne({
      driverId: uid,
      status: { $in: ACTIVE_STATUSES },
    })
      .sort({ createdAt: -1 })
      .lean()

    res.json({
      success: true,
      trip: trip || null,
    })
  } catch (error) {
    return sendServerError(res)
  }
}

const getDriverTrips = async (req, res) => {
  try {
    const uid = tripUid(req)

    const contract = await Contract.findOne({
      driverId: uid,
      status: 'active',
      vehicleCategory: 'transport',
    }).lean()

    if (!contract) {
      return res.json({
        success: true,
        trips: [],
        contract: null,
      })
    }

    const trips = await TripRecord.find({
      contractId: contract._id,
      driverId: uid,
    })
      .populate('ownerId', 'name phone')
      .sort({ createdAt: -1 })
      .lean()

    res.json({
      success: true,
      trips,
      contract,
    })
  } catch (error) {
    return sendServerError(res)
  }
}

const getOwnerTrips = async (req, res) => {
  try {
    const uid = tripUid(req)

    const trips = await TripRecord.find({
      ownerId: uid,
      status: {
        $in: ['submitted', 'approved', 'rejected', 'partial'],
      },
    })
      .populate('driverId', 'name phone')
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean()

    res.json({
      success: true,
      trips,
    })
  } catch (error) {
    return sendServerError(res)
  }
}

const assertOwnerTrip = async (trip, ownerUid) => {
  const contract = await Contract.findById(trip.contractId)
    .select('ownerId')
    .lean()
  if (!contract || String(contract.ownerId) !== String(ownerUid)) {
    return false
  }
  return true
}

const handleTrip = async (req, res) => {
  try {
    const {
      tripId,
      action,
      approvedAmount,
      approvedExpenses,
      note,
      ownerNote,
    } = req.body
    const uid = tripUid(req)

    if (!isValidObjectId(tripId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid trip ID',
      })
    }

    if (!ALLOWED_REVIEW_ACTIONS.includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action approved ya rejected ho sakti hai',
      })
    }

    const trip = await TripRecord.findById(tripId).populate(
      'driverId',
      'name'
    )

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip nahi mili',
      })
    }

    if (!(await assertOwnerTrip(trip, uid))) {
      return res.status(403).json({
        success: false,
        message: 'Access nahi hai',
      })
    }

    if (trip.status !== 'submitted') {
      return res.status(400).json({
        success: false,
        message: 'Yeh trip ab review ke liye pending nahi hai',
      })
    }

    const act = action === 'approved' ? 'approved' : 'rejected'
    trip.status = act
    trip.ownerNote = String(note ?? ownerNote ?? '').trim().slice(0, MAX_NOTE_LENGTH)

    const approvedNum =
      act === 'approved'
        ? Number(approvedAmount ?? approvedExpenses) ||
          trip.totalExpenses ||
          0
        : 0
    trip.approvedAmount = approvedNum
    trip.approvedExpenses = approvedNum
    trip.handledAt = new Date()
    trip.reviewedAt = new Date()
    await trip.save()

    const driverRef = trip.driverId?._id || trip.driverId
    if (driverRef) {
      // Non-blocking notification
      createNotificationSafe({
        userId: driverRef,
        title: act === 'approved' ? 'Trip Approved' : 'Trip Rejected',
        message:
          act === 'approved'
            ? `Your trip was approved. Amount: ₹${trip.approvedAmount}`
            : `Your trip was rejected. ${trip.ownerNote || ''}`,
        type: 'trip_update',
        link: '/driver/trips',
        isRead: false,
      })
    }

    res.json({
      success: true,
      message: `Trip ${act} ho gayi`,
      trip,
    })
  } catch (error) {
    return sendServerError(res)
  }
}

const submitTrip = completeTrip

const reviewTrip = handleTrip

const createRepairRequest = async (req, res) => {
  try {
    const { description, amount } = req.body
    const uid = tripUid(req)

    if (!description || amount === undefined || amount === '') {
      return res.status(400).json({
        success: false,
        message: 'Description aur amount required hai',
      })
    }

    const amtNum = Number(amount)
    if (!Number.isFinite(amtNum) || amtNum < 0 || amtNum > MAX_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: 'Amount valid honi chahiye',
      })
    }

    const descTrim = String(description).trim().slice(0, MAX_DESCRIPTION_LENGTH)

    const contract = await Contract.findOne({
      driverId: uid,
      status: 'active',
    })
      .select('_id ownerId')
      .lean()

    if (!contract) {
      return res.status(400).json({
        success: false,
        message: 'Koi active contract nahi',
      })
    }

    const repair = await RepairRequest.create({
      contractId: contract._id,
      driverId: uid,
      ownerId: contract.ownerId,
      description: descTrim,
      amount: amtNum,
      status: 'pending',
    })

    // Non-blocking notification
    createNotificationSafe({
      userId: contract.ownerId,
      title: 'Repair Requested',
      message: `The driver requested a repair of ₹${amtNum}: ${descTrim}`,
      type: 'payment_received',
      link: '/owner/trips',
      isRead: false,
    })

    res.json({
      success: true,
      repair,
      message: 'Repair request bhej di!',
    })
  } catch (error) {
    return sendServerError(res)
  }
}

const reviewRepairRequest = async (req, res) => {
  try {
    const { repairId, action, ownerNote } = req.body
    const uid = tripUid(req)

    if (!isValidObjectId(repairId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid repair ID',
      })
    }

    if (!ALLOWED_REVIEW_ACTIONS.includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action approved ya rejected ho sakti hai',
      })
    }

    const noteTrim = String(ownerNote || '').slice(0, MAX_NOTE_LENGTH)

    const repair = await RepairRequest.findOneAndUpdate(
      {
        _id: repairId,
        ownerId: uid,
        status: 'pending',
      },
      {
        $set: {
          status: action,
          ownerNote: noteTrim,
          reviewedAt: new Date(),
        },
      },
      { new: true }
    )

    if (!repair) {
      return res.status(404).json({
        success: false,
        message: 'Request nahi mili',
      })
    }

    // Non-blocking notification
    createNotificationSafe({
      userId: repair.driverId,
      title: action === 'approved' ? 'Repair Approved' : 'Repair Rejected',
      message:
        action === 'approved'
          ? `Your ₹${repair.amount} repair was approved.`
          : `Repair rejected: ${noteTrim}`,
      type: 'payment_received',
      link: '/driver/trips',
      isRead: false,
    })

    res.json({
      success: true,
      message: `Repair ${action} ho gayi!`,
    })
  } catch (error) {
    return sendServerError(res)
  }
}

module.exports = {
  createTrip,
  addExpense,
  addRepair,
  completeTrip,
  submitTrip,
  getActiveTrip,
  getDriverTrips,
  getOwnerTrips,
  handleTrip,
  reviewTrip,
  createRepairRequest,
  reviewRepairRequest,
}
