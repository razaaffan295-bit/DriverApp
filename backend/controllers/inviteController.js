const sendInvite = async (req, res) => {
  try {
    const DriverInvite = require('../models/DriverInvite')
    const User = require('../models/User')
    const Vehicle = require('../models/Vehicle')
    const Notification = require('../models/Notification')

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

    const driver = await User.findOne({
      phone: driverPhone,
      role: 'driver',
    })

    if (!driver) {
      return res.status(404).json({
        success: false,
        message:
          'Is phone number pe koi driver registered nahi hai. Driver ko pehle DriverApp mein signup karwao.',
        driverNotFound: true,
      })
    }

    const Contract = require('../models/Contract')
    const activeContract = await Contract.findOne({
      driverId: driver._id,
      status: 'active',
    })

    if (activeContract) {
      return res.status(400).json({
        success: false,
        message: 'Yeh driver already kisi aur kaam pe active hai.',
      })
    }

    const existingInvite = await DriverInvite.findOne({
      ownerId: req.user._id,
      driverId: driver._id,
      status: 'pending',
    })

    if (existingInvite) {
      return res.status(400).json({
        success: false,
        message:
          'Is driver ko invite pehle se bheja hua hai. Driver ke accept karne ka wait karein.',
      })
    }

    if (vehicleId) {
      const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        ownerId: req.user._id,
      })

      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: 'Gadi nahi mili',
        })
      }
    }

    const invite = await DriverInvite.create({
      ownerId: req.user._id,
      driverId: driver._id,
      vehicleId: vehicleId || null,
      driverPhone,
      vehicleCategory,
      salaryType,
      salaryPerDay: salaryPerDay || 0,
      salaryPerMonth: salaryPerMonth || 0,
      salaryPerHour: salaryPerHour || 0,
      dailyBhatta: dailyBhatta || 0,
      hasBhatta: hasBhatta || false,
      hasHourlyBonus: hasHourlyBonus || false,
      transportType: transportType || 'none',
      duration: duration || 30,
      startDate: startDate || new Date(),
      terms: terms || '',
      safetyConditions: safetyConditions || '',
      workLocation: workLocation || '',
      status: 'pending',
    })

    await Notification.create({
      userId: driver._id,
      title: 'Kaam Ka Offer Aaya!',
      message: `${req.user.name} ne aapko directly kaam pe invite kiya hai. Accept ya reject karein.`,
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
    return res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const getOwnerInvites = async (req, res) => {
  try {
    const DriverInvite = require('../models/DriverInvite')

    const invites = await DriverInvite.find({
      ownerId: req.user._id,
    })
      .populate('driverId', 'name phone location profilePhoto')
      .populate('vehicleId', 'vehicleType vehicleNumber')
      .sort({ createdAt: -1 })

    return res.json({ success: true, invites })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const getDriverInvites = async (req, res) => {
  try {
    const DriverInvite = require('../models/DriverInvite')

    const invites = await DriverInvite.find({
      driverId: req.user._id,
      status: 'pending',
    })
      .populate('ownerId', 'name phone location profilePhoto')
      .populate('vehicleId', 'vehicleType vehicleNumber')
      .sort({ createdAt: -1 })

    return res.json({ success: true, invites })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const acceptInvite = async (req, res) => {
  try {
    const DriverInvite = require('../models/DriverInvite')
    const Contract = require('../models/Contract')
    const Job = require('../models/Job')
    const Vehicle = require('../models/Vehicle')
    const Notification = require('../models/Notification')

    const { inviteId } = req.body

    const invite = await DriverInvite.findById(inviteId)
      .populate('ownerId', 'name')
      .populate('vehicleId', 'vehicleType vehicleNumber')

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

    const contract = await Contract.create({
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
    })

    if (invite.vehicleId) {
      await Vehicle.findByIdAndUpdate(invite.vehicleId._id, {
        assignedDriver: req.user._id,
      })
    }

    invite.status = 'accepted'
    await invite.save()

    await Notification.create({
      userId: invite.ownerId._id,
      title: 'Driver ne Invite Accept Kiya!',
      message: `${req.user.name} ne aapka invite accept kar liya. Kaam shuru ho gaya!`,
      type: 'application_accepted',
      link: '/owner/drivers',
      isRead: false,
    })

    return res.json({
      success: true,
      contract,
      message: 'Invite accept kar liya! Kaam shuru ho gaya.',
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const rejectInvite = async (req, res) => {
  try {
    const DriverInvite = require('../models/DriverInvite')
    const Notification = require('../models/Notification')

    const { inviteId, reason } = req.body

    const invite = await DriverInvite.findById(inviteId).populate(
      'ownerId',
      'name'
    )

    if (!invite || String(invite.driverId) !== String(req.user._id)) {
      return res.status(404).json({
        success: false,
        message: 'Invite nahi mila',
      })
    }

    invite.status = 'rejected'
    await invite.save()

    await Notification.create({
      userId: invite.ownerId._id,
      title: 'Driver ne Invite Reject Kiya',
      message: `${req.user.name} ne invite reject kar diya. ${reason || ''}`,
      type: 'application_accepted',
      link: '/owner/drivers',
      isRead: false,
    })

    return res.json({
      success: true,
      message: 'Invite reject kar diya',
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

module.exports = {
  sendInvite,
  getOwnerInvites,
  getDriverInvites,
  acceptInvite,
  rejectInvite,
}

