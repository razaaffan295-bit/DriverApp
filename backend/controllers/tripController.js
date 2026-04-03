const createTrip = async (req, res) => {
  try {
    const TripRecord =
      require('../models/TripRecord')
    const Contract =
      require('../models/Contract')

    const { tripDate, fromLocation,
      toLocation, description } = req.body

    const contract = await Contract.findOne({
      driverId: req.user.id,
      status: 'active',
      vehicleCategory: 'transport'
    })

    if (!contract) {
      return res.status(400).json({
        success: false,
        message: 'Koi active transport \n          contract nahi'
      })
    }

    const trip = await TripRecord.create({
      contractId: contract._id,
      driverId: req.user.id,
      ownerId: contract.ownerId,
      transportType: contract.transportType,
      tripDate: new Date(tripDate),
      fromLocation: fromLocation || '',
      toLocation: toLocation || '',
      description: description || '',
      expenses: [],
      totalExpenses: 0,
      status: 'draft'
    })

    res.json({
      success: true, trip,
      message: 'Trip start ho gaya!'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

const addExpense = async (req, res) => {
  try {
    const TripRecord =
      require('../models/TripRecord')

    const { tripId, category,
      amount, description } = req.body

    const trip = await TripRecord.findOne({
      _id: tripId,
      driverId: req.user.id,
      status: 'draft'
    })

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip nahi mili ya \n          already submitted hai'
      })
    }

    if (trip.transportType !== 'malik_trip') {
      return res.status(400).json({
        success: false,
        message: 'Company trip mein \n          expense nahi hota'
      })
    }

    trip.expenses.push({
      category,
      amount: Number(amount),
      description: description || ''
    })

    trip.totalExpenses = trip.expenses
      .reduce((sum, e) =>
        sum + (e.amount || 0), 0)

    await trip.save()

    res.json({
      success: true, trip,
      message: 'Expense add ho gaya!'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

const submitTrip = async (req, res) => {
  try {
    const TripRecord =
      require('../models/TripRecord')
    const Notification =
      require('../models/Notification')

    const { tripId } = req.body

    const trip = await TripRecord.findOne({
      _id: tripId,
      driverId: req.user.id,
      status: 'draft'
    })

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip nahi mili'
      })
    }

    trip.status = 'submitted'
    trip.submittedAt = new Date()
    await trip.save()

    await Notification.create({
      userId: trip.ownerId,
      title: 'Trip Request Aayi!',
      message: trip.transportType ===
        'malik_trip'
        ? `Driver ne trip complete ki. \n           ₹${trip.totalExpenses} expenses \n           verify karein.`
        : `Driver ne trip complete ki.`,
      type: 'payment_received',
      link: '/owner/trips',
      isRead: false
    })

    res.json({
      success: true,
      message: 'Trip submit ho gayi! \n        Owner verify karega.'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

const getDriverTrips = async (req, res) => {
  try {
    const TripRecord =
      require('../models/TripRecord')
    const Contract =
      require('../models/Contract')

    const contract = await Contract.findOne({
      driverId: req.user.id,
      status: 'active',
      vehicleCategory: 'transport'
    })

    if (!contract) {
      return res.json({
        success: true,
        trips: [],
        contract: null
      })
    }

    const trips = await TripRecord
      .find({
        contractId: contract._id,
        driverId: req.user.id
      })
      .sort({ createdAt: -1 })

    res.json({
      success: true, trips, contract
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

const getOwnerTrips = async (req, res) => {
  try {
    const TripRecord =
      require('../models/TripRecord')
    const { contractId } = req.query

    const query = {
      ownerId: req.user.id,
      status: 'submitted'
    }
    if (contractId)
      query.contractId = contractId

    const trips = await TripRecord
      .find(query)
      .populate('driverId', 'name phone')
      .sort({ createdAt: -1 })

    res.json({ success: true, trips })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

const reviewTrip = async (req, res) => {
  try {
    const TripRecord =
      require('../models/TripRecord')
    const Notification =
      require('../models/Notification')

    const { tripId, action,
      approvedExpenses, ownerNote } = req.body

    const trip = await TripRecord.findOne({
      _id: tripId,
      ownerId: req.user.id,
      status: 'submitted'
    })

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip nahi mili'
      })
    }

    trip.status = action
    trip.approvedExpenses =
      approvedExpenses || 0
    trip.ownerNote = ownerNote || ''
    trip.reviewedAt = new Date()
    await trip.save()

    await Notification.create({
      userId: trip.driverId,
      title: action === 'approved'
        ? 'Trip Approve Ho Gayi!'
        : 'Trip Review Ho Gayi',
      message: action === 'approved'
        ? `₹${approvedExpenses} expenses \n           approve ho gaye.`
        : `Owner ne trip review ki. \n           Note: ${ownerNote}`,
      type: 'payment_received',
      link: '/driver/trips',
      isRead: false
    })

    res.json({
      success: true,
      message: `Trip ${action} ho gayi!`
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

const createRepairRequest =
  async (req, res) => {
    try {
      const RepairRequest =
        require('../models/RepairRequest')
      const Contract =
        require('../models/Contract')
      const Notification =
        require('../models/Notification')

      const { description, amount } = req.body

      if (!description || !amount) {
        return res.status(400).json({
          success: false,
          message: 'Description aur amount \n          required hai'
        })
      }

      const contract = await Contract.findOne({
        driverId: req.user.id,
        status: 'active'
      })

      if (!contract) {
        return res.status(400).json({
          success: false,
          message: 'Koi active contract nahi'
        })
      }

      const repair = await RepairRequest.create({
        contractId: contract._id,
        driverId: req.user.id,
        ownerId: contract.ownerId,
        description,
        amount: Number(amount),
        status: 'pending'
      })

      await Notification.create({
        userId: contract.ownerId,
        title: 'Repair Request Aayi!',
        message: `Driver ne ₹${amount} \n        repair request ki: ${description}`,
        type: 'payment_received',
        link: '/owner/repairs',
        isRead: false
      })

      res.json({
        success: true,
        repair,
        message: 'Repair request bhej di!'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

const reviewRepairRequest =
  async (req, res) => {
    try {
      const RepairRequest =
        require('../models/RepairRequest')
      const Notification =
        require('../models/Notification')

      const { repairId, action, ownerNote } =
        req.body

      const repair = await RepairRequest
        .findOne({
          _id: repairId,
          ownerId: req.user.id,
          status: 'pending'
        })

      if (!repair) {
        return res.status(404).json({
          success: false,
          message: 'Request nahi mili'
        })
      }

      repair.status = action
      repair.ownerNote = ownerNote || ''
      repair.reviewedAt = new Date()
      await repair.save()

      await Notification.create({
        userId: repair.driverId,
        title: action === 'approved'
          ? 'Repair Approved!'
          : 'Repair Reject Ho Gayi',
        message: action === 'approved'
          ? `₹${repair.amount} repair \n           approve ho gayi.`
          : `Repair reject: ${ownerNote}`,
        type: 'payment_received',
        link: '/driver/trips',
        isRead: false
      })

      res.json({
        success: true,
        message: `Repair ${action} ho gayi!`
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

module.exports = {
  createTrip,
  addExpense,
  submitTrip,
  getDriverTrips,
  getOwnerTrips,
  reviewTrip,
  createRepairRequest,
  reviewRepairRequest
}

