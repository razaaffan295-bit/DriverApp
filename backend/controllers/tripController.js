const tripUid = (req) => req.user._id || req.user.id

const ACTIVE_STATUSES = ['draft', 'active']

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
  const allowed = new Set([
    'diesel',
    'toll',
    'police',
    'khana',
    'repair',
    'other',
  ])
  return allowed.has(String(raw)) ? String(raw) : 'other'
}

const createTrip = async (req, res) => {
  try {
    const TripRecord = require('../models/TripRecord')
    const Contract = require('../models/Contract')

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
    })

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
    })
    if (openTrip) {
      return res.status(400).json({
        success: false,
        message: 'Pehle se ek active trip hai — use complete karein',
      })
    }

    const fromVal = fromLocation || from || ''
    const toVal = toLocation || to || ''
    const cargoVal = cargo || ''

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
      description: description || cargoVal || '',
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
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const addExpense = async (req, res) => {
  try {
    const TripRecord = require('../models/TripRecord')

    const { tripId, amount, note, image, photo, description } =
      req.body

    const uid = tripUid(req)

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
    const imgVal = image || photo || ''

    trip.expenses.push({
      type: expType,
      category: expType,
      amount: Number(amount) || 0,
      note: noteVal,
      description: noteVal,
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
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const addRepair = async (req, res) => {
  try {
    const TripRecord = require('../models/TripRecord')

    const { tripId, description, amount, image } = req.body
    const uid = tripUid(req)

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

    trip.repairs = trip.repairs || []
    trip.repairs.push({
      description: description != null ? String(description) : '',
      amount: Number(amount) || 0,
      image: image || '',
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
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const completeTrip = async (req, res) => {
  try {
    const TripRecord = require('../models/TripRecord')
    const Notification = require('../models/Notification')
    const Contract = require('../models/Contract')

    const { tripId } = req.body
    const uid = tripUid(req)

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

    const contract = await Contract.findById(trip.contractId)
    const ownerRef = contract?.ownerId || trip.ownerId
    const fromLabel =
      trip.fromLocation || trip.from || '—'
    const toLabel = trip.toLocation || trip.to || '—'

    if (ownerRef) {
      await Notification.create({
        userId: ownerRef,
        title: 'Trip Submit Ho Gayi!',
        message: `${trip.driverId?.name || 'Driver'} ne trip submit ki. ${fromLabel} → ${toLabel}. Total kharcha: ₹${totalExpenses}`,
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
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const getActiveTrip = async (req, res) => {
  try {
    const TripRecord = require('../models/TripRecord')
    const uid = tripUid(req)

    const trip = await TripRecord.findOne({
      driverId: uid,
      status: { $in: ACTIVE_STATUSES },
    }).sort({ createdAt: -1 })

    res.json({
      success: true,
      trip: trip || null,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const getDriverTrips = async (req, res) => {
  try {
    const TripRecord = require('../models/TripRecord')
    const Contract = require('../models/Contract')
    const uid = tripUid(req)

    const contract = await Contract.findOne({
      driverId: uid,
      status: 'active',
      vehicleCategory: 'transport',
    })

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

    res.json({
      success: true,
      trips,
      contract,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const getOwnerTrips = async (req, res) => {
  try {
    const TripRecord = require('../models/TripRecord')
    const uid = tripUid(req)

    const trips = await TripRecord.find({
      ownerId: uid,
      status: {
        $in: [
          'submitted',
          'approved',
          'rejected',
          'partial',
        ],
      },
    })
      .populate('driverId', 'name phone')
      .sort({ submittedAt: -1, createdAt: -1 })

    res.json({
      success: true,
      trips,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const assertOwnerTrip = async (trip, ownerUid) => {
  const Contract = require('../models/Contract')
  const contract = await Contract.findById(trip.contractId)
  if (!contract || String(contract.ownerId) !== String(ownerUid)) {
    return false
  }
  return true
}

const handleTrip = async (req, res) => {
  try {
    const TripRecord = require('../models/TripRecord')
    const Notification = require('../models/Notification')

    const {
      tripId,
      action,
      approvedAmount,
      approvedExpenses,
      note,
      ownerNote,
    } = req.body
    const uid = tripUid(req)

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
    trip.ownerNote = String(note ?? ownerNote ?? '').trim()

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
      await Notification.create({
        userId: driverRef,
        title:
          act === 'approved'
            ? 'Trip Approve Ho Gayi!'
            : 'Trip Reject Ho Gayi',
        message:
          act === 'approved'
            ? `Aapki trip approve ho gayi. Amount: ₹${trip.approvedAmount}`
            : `Aapki trip reject ho gayi. ${trip.ownerNote || ''}`,
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
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const submitTrip = completeTrip

const reviewTrip = handleTrip

const createRepairRequest = async (req, res) => {
  try {
    const RepairRequest = require('../models/RepairRequest')
    const Contract = require('../models/Contract')
    const Notification = require('../models/Notification')

    const { description, amount } = req.body
    const uid = tripUid(req)

    if (!description || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Description aur amount required hai',
      })
    }

    const contract = await Contract.findOne({
      driverId: uid,
      status: 'active',
    })

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
      description,
      amount: Number(amount),
      status: 'pending',
    })

    await Notification.create({
      userId: contract.ownerId,
      title: 'Repair Request Aayi!',
      message: `Driver ne ₹${amount} repair request ki: ${description}`,
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
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const reviewRepairRequest = async (req, res) => {
  try {
    const RepairRequest = require('../models/RepairRequest')
    const Notification = require('../models/Notification')

    const { repairId, action, ownerNote } = req.body
    const uid = tripUid(req)

    const repair = await RepairRequest.findOne({
      _id: repairId,
      ownerId: uid,
      status: 'pending',
    })

    if (!repair) {
      return res.status(404).json({
        success: false,
        message: 'Request nahi mili',
      })
    }

    repair.status = action
    repair.ownerNote = ownerNote || ''
    repair.reviewedAt = new Date()
    await repair.save()

    await Notification.create({
      userId: repair.driverId,
      title:
        action === 'approved' ? 'Repair Approved!' : 'Repair Reject Ho Gayi',
      message:
        action === 'approved'
          ? `₹${repair.amount} repair approve ho gayi.`
          : `Repair reject: ${ownerNote}`,
      type: 'payment_received',
      link: '/driver/trips',
      isRead: false,
    })

    res.json({
      success: true,
      message: `Repair ${action} ho gayi!`,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
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
