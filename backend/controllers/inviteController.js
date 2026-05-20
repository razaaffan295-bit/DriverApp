const mongoose = require('mongoose')
const DriverInvite = require('../models/DriverInvite')
const User = require('../models/User')
const Vehicle = require('../models/Vehicle')
const Notification = require('../models/Notification')
const Contract = require('../models/Contract')
const Job = require('../models/Job')

// Constants
const PHONE_REGEX = /^\d{10}$/
const MAX_TERMS_LENGTH = 5000
const MAX_SAFETY_LENGTH = 5000
const MAX_LOCATION_LENGTH = 500
const MAX_REASON_LENGTH = 500
const MAX_DURATION_DAYS = 1825
const MAX_SALARY = 1000000

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

const isSubscriptionActive = (user) => {
  if (user.isPermanentFree) return true
  if (!user.subscriptionRequired) return true
  if (
    user.subscription?.isActive === true &&
    user.subscription?.endDate &&
    new Date(user.subscription.endDate) > new Date()
  )
    return true
  return false
}

const sendInvite = async (req, res) => {
  try {
    const {
      driverPhone,
      vehicleId,
      vehicleCategory,
      salaryType,
      salaryPerDay,
      salaryPerMonth,
      salaryPerHour,
      dailyBhatta,
      hasBhatta,
      hasHourlyBonus,
      transportType,
      duration,
      startDate,
      terms,
      safetyConditions,
      workLocation,
    } = req.body

    if (!driverPhone || !vehicleCategory || !salaryType) {
      return res.status(400).json({
        success: false,
        message: 'Phone, category aur salary type required hai',
      })
    }

    // Phone format validation
    const phoneTrim = String(driverPhone).trim()
    if (!PHONE_REGEX.test(phoneTrim)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number 10 digit ka hona chahiye',
      })
    }

    // Validate optional vehicleId format
    if (vehicleId && !isValidObjectId(vehicleId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle ID',
      })
    }

    // Salary upper bound checks
    if (salaryPerDay && Number(salaryPerDay) > MAX_SALARY) {
      return res.status(400).json({
        success: false,
        message: 'Salary per day too large',
      })
    }
    if (salaryPerMonth && Number(salaryPerMonth) > MAX_SALARY) {
      return res.status(400).json({
        success: false,
        message: 'Salary per month too large',
      })
    }
    if (salaryPerHour && Number(salaryPerHour) > MAX_SALARY) {
      return res.status(400).json({
        success: false,
        message: 'Salary per hour too large',
      })
    }

    // Duration upper bound
    const durationNum = Number(duration) || 30
    if (durationNum < 1 || durationNum > MAX_DURATION_DAYS) {
      return res.status(400).json({
        success: false,
        message: 'Duration 1 se 1825 din ke beech honi chahiye',
      })
    }

    // Find driver first (need _id for other queries)
    const driver = await User.findOne({
      phone: phoneTrim,
      role: 'driver',
    }).select('_id name').lean()

    if (!driver) {
      return res.status(404).json({
        success: false,
        message:
          'Is phone number pe koi driver registered nahi hai. Driver ko pehle DriverApp mein signup karwao.',
        driverNotFound: true,
      })
    }

    // Self-invite prevention
    if (String(driver._id) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'Aap apne aap ko invite nahi kar sakte',
      })
    }

    // PARALLEL - check active contract + existing invite + vehicle ownership (3x faster)
    const [activeContract, existingInvite, vehicle] = await Promise.all([
      Contract.findOne({
        driverId: driver._id,
        status: 'active',
      }).select('_id').lean(),
      DriverInvite.findOne({
        ownerId: req.user._id,
        driverId: driver._id,
        status: 'pending',
      }).select('_id').lean(),
      vehicleId
        ? Vehicle.findOne({
            _id: vehicleId,
            ownerId: req.user._id,
          }).select('_id').lean()
        : Promise.resolve(null),
    ])

    if (activeContract) {
      return res.status(400).json({
        success: false,
        message: 'Yeh driver already kisi aur kaam pe active hai.',
      })
    }

    if (existingInvite) {
      return res.status(400).json({
        success: false,
        message:
          'Is driver ko invite pehle se bheja hua hai. Driver ke accept karne ka wait karein.',
      })
    }

    if (vehicleId && !vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Gadi nahi mili',
      })
    }

    const invite = await DriverInvite.create({
      ownerId: req.user._id,
      driverId: driver._id,
      vehicleId: vehicleId || null,
      driverPhone: phoneTrim,
      vehicleCategory,
      salaryType,
      salaryPerDay: Number(salaryPerDay) || 0,
      salaryPerMonth: Number(salaryPerMonth) || 0,
      salaryPerHour: Number(salaryPerHour) || 0,
      dailyBhatta: Number(dailyBhatta) || 0,
      hasBhatta: hasBhatta || false,
      hasHourlyBonus: hasHourlyBonus || false,
      transportType: transportType || 'none',
      duration: durationNum,
      startDate: startDate || new Date(),
      terms: String(terms || '').slice(0, MAX_TERMS_LENGTH),
      safetyConditions: String(safetyConditions || '').slice(0, MAX_SAFETY_LENGTH),
      workLocation: String(workLocation || '').slice(0, MAX_LOCATION_LENGTH),
      status: 'pending',
    })

    // Non-blocking notification
    createNotificationSafe({
      userId: driver._id,
      title: 'Work Invite',
      message: `${req.user.name} invited you to a job. Please accept or reject the invite.`,
      type: 'new_application',
      link: '/driver/invites',
      isRead: false,
    })

    return res.json({
      success: true,
      invite,
      driverName: driver.name,
      message: `${driver.name} ko invite bhej diya! Driver ke accept karne ka wait karein.`,
    })
  } catch (error) {
    return sendServerError(res)
  }
}

const getOwnerInvites = async (req, res) => {
  try {
    const invites = await DriverInvite.find({
      ownerId: req.user._id,
    })
      .populate('driverId', 'name phone location profilePhoto')
      .populate('vehicleId', 'vehicleType vehicleNumber')
      .sort({ createdAt: -1 })
      .lean()

    return res.json({ success: true, invites })
  } catch (error) {
    return sendServerError(res)
  }
}

const getDriverInvites = async (req, res) => {
  try {
    const invites = await DriverInvite.find({
      driverId: req.user._id,
      status: 'pending',
    })
      .populate('ownerId', 'name phone location profilePhoto')
      .populate('vehicleId', 'vehicleType vehicleNumber')
      .sort({ createdAt: -1 })
      .lean()

    return res.json({ success: true, invites })
  } catch (error) {
    return sendServerError(res)
  }
}

const acceptInvite = async (req, res) => {
  try {
    const { inviteId } = req.body

    // Validate ObjectId
    if (!isValidObjectId(inviteId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invite ID',
      })
    }

    // Parallel - user + invite + active contract check (3x faster)
    const [driverUser, invite, existingContract] = await Promise.all([
      User.findById(req.user._id)
        .select('subscription isPermanentFree subscriptionRequired')
        .lean(),
      DriverInvite.findById(inviteId)
        .populate('ownerId', 'name')
        .populate('vehicleId', 'vehicleType vehicleNumber'),
      Contract.findOne({
        driverId: req.user._id,
        status: { $in: ['active', 'sent'] },
      }).select('_id').lean(),
    ])

    if (!driverUser) {
      return res.status(401).json({
        success: false,
        message: 'User nahi mila',
      })
    }

    if (!isSubscriptionActive(driverUser)) {
      return res.status(403).json({
        success: false,
        message:
          'Invite accept karne ke liye active subscription chahiye (₹99/month).',
        code: 'SUBSCRIPTION_REQUIRED',
      })
    }

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: 'Invite nahi mila',
      })
    }

    if (String(invite.driverId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access nahi hai',
      })
    }

    if (invite.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Yeh invite already process ho chuka hai',
      })
    }

    if (existingContract) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active or pending contract',
      })
    }

    // Create job (needed first for contract jobId)
    const job = await Job.create({
      ownerId: invite.ownerId._id,
      vehicleId: invite.vehicleId?._id,
      vehicleType: invite.vehicleId?.vehicleType || 'Other',
      title: `Direct Hire — ${invite.vehicleId?.vehicleType || 'Vehicle'}`,
      description: 'Direct hire by owner',
      location: { state: '', district: '' },
      vehicleCategory: invite.vehicleCategory,
      salaryType: invite.salaryType,
      salaryPerDay: invite.salaryPerDay,
      salaryPerMonth: invite.salaryPerMonth,
      salaryPerHour: invite.salaryPerHour,
      dailyBhatta: invite.dailyBhatta,
      hasBhatta: invite.hasBhatta,
      hasHourlyBonus: invite.hasHourlyBonus,
      transportType: invite.transportType,
      duration: invite.duration,
      startDate: invite.startDate,
      status: 'filled',
      hiredDriver: req.user._id,
    })

    // PARALLEL - contract create + vehicle update + invite save (3x faster)
    invite.status = 'accepted'

    const [contract] = await Promise.all([
      Contract.create({
        jobId: job._id,
        ownerId: invite.ownerId._id,
        driverId: req.user._id,
        vehicleCategory: invite.vehicleCategory,
        salaryType: invite.salaryType,
        salaryPerDay: invite.salaryPerDay,
        salaryPerMonth: invite.salaryPerMonth,
        salaryPerHour: invite.salaryPerHour,
        dailyBhatta: invite.dailyBhatta,
        hasBhatta: invite.hasBhatta,
        hasHourlyBonus: invite.hasHourlyBonus,
        transportType: invite.transportType,
        duration: invite.duration,
        startDate: invite.startDate,
        workLocation: invite.workLocation,
        terms: invite.terms,
        safetyConditions: invite.safetyConditions,
        status: 'active',
        driverSigned: true,
        driverSignedAt: new Date(),
      }),
      invite.vehicleId
        ? Vehicle.findByIdAndUpdate(invite.vehicleId._id, {
            assignedDriver: req.user._id,
          })
        : Promise.resolve(null),
      invite.save(),
    ])

    // Non-blocking notification
    createNotificationSafe({
      userId: invite.ownerId._id,
      title: 'Invite Accepted',
      message: `${req.user.name} accepted your invite. Work has started.`,
      type: 'application_accepted',
      link: '/owner/applications',
      isRead: false,
    })

    return res.json({
      success: true,
      contract,
      message: 'Invite accept kar liya! Kaam shuru ho gaya.',
    })
  } catch (error) {
    return sendServerError(res)
  }
}

const rejectInvite = async (req, res) => {
  try {
    const { inviteId, reason } = req.body

    // Validate ObjectId
    if (!isValidObjectId(inviteId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invite ID',
      })
    }

    const reasonTrim = String(reason || '').slice(0, MAX_REASON_LENGTH)

    // Atomic update - find + reject in 1 query
    const invite = await DriverInvite.findOneAndUpdate(
      {
        _id: inviteId,
        driverId: req.user._id,
      },
      { $set: { status: 'rejected' } },
      { new: true }
    ).populate('ownerId', 'name')

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: 'Invite nahi mila',
      })
    }

    // Non-blocking notification
    createNotificationSafe({
      userId: invite.ownerId._id,
      title: 'Invite Rejected',
      message: `${req.user.name} rejected the invite. ${reasonTrim}`,
      type: 'application_accepted',
      link: '/owner/applications',
      isRead: false,
    })

    return res.json({
      success: true,
      message: 'Invite reject kar diya',
    })
  } catch (error) {
    return sendServerError(res)
  }
}

module.exports = {
  sendInvite,
  getOwnerInvites,
  getDriverInvites,
  acceptInvite,
  rejectInvite,
}
