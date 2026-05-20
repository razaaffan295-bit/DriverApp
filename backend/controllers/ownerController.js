const OwnerProfile = require("../models/OwnerProfile");
const Vehicle = require("../models/Vehicle");
const User = require("../models/User");
const Rating = require("../models/Rating");
const Contract = require("../models/Contract");
const Job = require("../models/Job");
const DriverProfile = require("../models/DriverProfile");
const DriverAttendance = require("../models/DriverAttendance");
const OwnerAttendance = require("../models/OwnerAttendance");
const Payment = require("../models/Payment");
const Application = require("../models/Application");
const DriverInvite = require("../models/DriverInvite");

// Helper for consistent 500 responses
const sendServerError = (res) => {
  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Server error'
      : undefined,
  });
};

// Calculate average rating from array
const calcAvgRating = (ratings) => {
  if (!Array.isArray(ratings) || ratings.length === 0) return "0";
  const sum = ratings.reduce((s, r) => s + (Number(r.score) || 0), 0);
  return (sum / ratings.length).toFixed(1);
};

const getOwnerProfile = async (req, res) => {
  try {
    const ownerId = req.user._id;

    // Parallel - 2x faster
    const [user, profile] = await Promise.all([
      User.findById(ownerId).select("-password").lean(),
      OwnerProfile.findOne({ ownerId }).lean(),
    ]);

    return res.json({
      success: true,
      profile: profile || null,
      user,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const uploadProfilePhoto = async (req, res) => {
  try {
    const ownerId = req.user._id || req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Photo select karo",
      });
    }

    const photoUrl =
      req.file.path || req.file.secure_url || req.file.url || "";
    if (!photoUrl) {
      return res.status(500).json({
        success: false,
        message: "Upload URL nahi mila",
      });
    }

    // Parallel updates - 2x faster
    await Promise.all([
      User.findByIdAndUpdate(ownerId, {
        profilePhoto: photoUrl,
      }),
      OwnerProfile.findOneAndUpdate(
        { ownerId },
        {
          $set: { profilePhoto: photoUrl },
          $setOnInsert: { ownerId, isProfileComplete: false },
        },
        { upsert: true, new: true }
      ),
    ]);

    return res.json({
      success: true,
      message: "Photo upload ho gayi!",
      photo: photoUrl,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const updateOwnerProfile = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const {
      name,
      companyName,
      about,
      state,
      district,
      profilePhoto,
    } = req.body;

    // Input length validation
    if (name !== undefined) {
      const nameTrim = String(name).trim();
      if (nameTrim.length < 1 || nameTrim.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Naam 1 se 100 characters ka hona chahiye",
        });
      }
    }
    if (companyName !== undefined && String(companyName).length > 200) {
      return res.status(400).json({
        success: false,
        message: "Company name 200 characters se kam hona chahiye",
      });
    }
    if (about !== undefined && String(about).length > 1000) {
      return res.status(400).json({
        success: false,
        message: "About 1000 characters se kam hona chahiye",
      });
    }

    const user = await User.findById(ownerId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila",
      });
    }

    // Update user fields
    if (name !== undefined) user.name = String(name).trim();
    if (state !== undefined || district !== undefined) {
      user.location = user.location || {};
      if (state !== undefined) user.location.state = String(state).trim();
      if (district !== undefined) user.location.district = String(district).trim();
    }
    if (profilePhoto !== undefined && profilePhoto !== "") {
      user.profilePhoto = String(profilePhoto).trim();
    }

    // Find/create profile
    let profile = await OwnerProfile.findOne({ ownerId });
    if (!profile) {
      // Save user and create profile in parallel
      const [, newProfile] = await Promise.all([
        user.save(),
        OwnerProfile.create({
          ownerId,
          companyName: companyName != null ? String(companyName).trim() : "",
          about: about != null ? String(about).trim() : "",
          isProfileComplete: true,
        }),
      ]);
      profile = newProfile;
    } else {
      // Update profile fields
      if (companyName !== undefined) profile.companyName = String(companyName).trim();
      if (about !== undefined) profile.about = String(about).trim();
      profile.isProfileComplete = true;

      // Save both in parallel
      await Promise.all([
        user.save(),
        profile.save(),
      ]);
    }

    // Return user from in-memory doc (no extra DB query needed)
    const userPayload = user.toObject();
    delete userPayload.password;

    return res.json({
      success: true,
      profile: profile.toObject ? profile.toObject() : profile,
      user: userPayload,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const addVehicle = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const {
      vehicleType,
      vehicleNumber,
      vehicleModel,
      state,
      district,
    } = req.body;

    if (!vehicleType || !state || !district) {
      return res.status(400).json({
        success: false,
        message: "Vehicle type, state aur district zaroori hain",
      });
    }

    // Input length validation
    if (String(vehicleType).length > 100) {
      return res.status(400).json({
        success: false,
        message: "Vehicle type 100 characters se kam hona chahiye",
      });
    }
    if (vehicleNumber && String(vehicleNumber).length > 20) {
      return res.status(400).json({
        success: false,
        message: "Vehicle number 20 characters se kam hona chahiye",
      });
    }
    if (vehicleModel && String(vehicleModel).length > 100) {
      return res.status(400).json({
        success: false,
        message: "Vehicle model 100 characters se kam hona chahiye",
      });
    }

    const vehicle = await Vehicle.create({
      ownerId,
      vehicleType: String(vehicleType).trim(),
      vehicleNumber: vehicleNumber
        ? String(vehicleNumber).trim().toUpperCase()
        : "",
      vehicleModel: vehicleModel ? String(vehicleModel).trim() : "",
      location: {
        state: String(state).trim(),
        district: String(district).trim(),
      },
    });

    return res.status(201).json({
      success: true,
      vehicle,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({
      ownerId: req.user._id,
    })
      .populate("assignedDriver", "name phone")
      .lean();

    return res.json({
      success: true,
      vehicles,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const deleteVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id).lean();
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Gadi nahi mili",
      });
    }
    if (String(vehicle.ownerId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Yeh aapki gadi nahi hai",
      });
    }
    if (vehicle.assignedDriver != null) {
      return res.status(400).json({
        success: false,
        message: "Pehle driver ko hatayein",
      });
    }
    await Vehicle.deleteOne({ _id: vehicle._id });
    return res.json({ success: true });
  } catch (error) {
    return sendServerError(res);
  }
};

const getPublicOwnerProfile = async (req, res) => {
  try {
    const ownerId = req.params.id;

    // Parallel queries - 4x faster
    const [user, profileDoc, vehicles, ratings] = await Promise.all([
      User.findById(ownerId)
        .select("_id name location isVerified profilePhoto role createdAt")
        .lean(),
      OwnerProfile.findOne({ ownerId })
        .select("companyName about isProfileComplete")
        .lean(),
      Vehicle.find({ ownerId, isActive: true })
        .select("vehicleType vehicleNumber vehicleModel location")
        .lean(),
      Rating.find({ ratedTo: ownerId })
        .select("score review createdAt")
        .populate("ratedBy", "name")
        .lean(),
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila",
      });
    }

    return res.json({
      success: true,
      user,
      profile: profileDoc || {},
      vehicles: vehicles || [],
      ratings: ratings || [],
      avgRating: calcAvgRating(ratings),
      totalRatings: ratings.length,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getVehicleDetail = async (req, res) => {
  try {
    // Step 1: Get vehicle first (need for authorization + assignedDriver)
    const vehicle = await Vehicle.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
    })
      .populate("assignedDriver", "name phone location profilePhoto isVerified")
      .lean();

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Gadi nahi mili",
      });
    }

    // Step 2: Get all job IDs for this vehicle
    const vehicleJobs = await Job.find({ vehicleId: vehicle._id })
      .select("_id")
      .lean();
    const vehicleJobIds = vehicleJobs.map((j) => j._id);

    // Step 3: PARALLEL - active contract + history + ratings
    const [activeContract, contractHistory, ratings] = await Promise.all([
      Contract.findOne({
        jobId: { $in: vehicleJobIds },
        status: "active",
      })
        .populate("driverId", "name phone location profilePhoto")
        .populate(
          "jobId",
          "title vehicleType vehicleCategory salaryType salaryPerDay salaryPerMonth salaryPerHour dailyBhatta hasBhatta hasHourlyBonus transportType"
        )
        .lean(),
      Contract.find({
        jobId: { $in: vehicleJobIds },
        status: { $in: ["completed", "terminated"] },
      })
        .populate("driverId", "name phone")
        .populate("jobId", "title vehicleType")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      vehicle.assignedDriver
        ? Rating.find({ ratedTo: vehicle.assignedDriver._id })
            .select("score")
            .lean()
        : Promise.resolve([]),
    ]);

    const driverRating = vehicle.assignedDriver ? calcAvgRating(ratings) : null;
    const ratingCount = ratings.length;

    return res.json({
      success: true,
      vehicle,
      activeContract,
      contractHistory,
      driverRating,
      ratingCount,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getDriverDetail = async (req, res) => {
  try {
    const ownerId = req.user._id || req.user.id;
    const driverId = req.params.id;

    // Step 1: Authorization check (parallel)
    const [app, contract, invite] = await Promise.all([
      Application.findOne({ ownerId, driverId }).select("_id").lean(),
      Contract.findOne({ ownerId, driverId }).select("_id").lean(),
      DriverInvite.findOne({ ownerId, driverId }).select("_id").lean(),
    ]);

    if (!app && !contract && !invite) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this driver",
      });
    }

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Step 2: Get driver, profile, active contract, history, ratings - ALL PARALLEL
    const [
      driver,
      profile,
      activeContract,
      contractHistory,
      ratings,
    ] = await Promise.all([
      User.findById(driverId)
        .select("name phone location profilePhoto isVerified createdAt")
        .lean(),
      DriverProfile.findOne({ driverId }).lean(),
      Contract.findOne({
        ownerId,
        driverId,
        status: "active",
      })
        .populate({
          path: "jobId",
          select: "title vehicleType vehicleCategory salaryType salaryPerDay salaryPerMonth salaryPerHour dailyBhatta hasBhatta hasHourlyBonus transportType startDate duration vehicleId",
          populate: {
            path: "vehicleId",
            select: "vehicleType vehicleNumber",
          },
        })
        .populate("driverId", "name phone location profilePhoto")
        .populate("ownerId", "name phone location profilePhoto")
        .lean(),
      Contract.find({
        ownerId,
        driverId,
        status: { $in: ["completed", "terminated"] },
      })
        .populate({
          path: "jobId",
          select: "title vehicleType vehicleId",
          populate: {
            path: "vehicleId",
            select: "vehicleType vehicleNumber",
          },
        })
        .sort({ createdAt: -1 })
        .lean(),
      Rating.find({ ratedTo: driverId })
        .populate("ratedBy", "name role")
        .populate("jobId", "title")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver nahi mila",
      });
    }

    // Step 3: If active contract, get attendance + payment summary (PARALLEL)
    let attendanceSummary = null;
    let paymentSummary = null;

    if (activeContract) {
      const [ownerRecords, payments] = await Promise.all([
        OwnerAttendance.find({
          contractId: activeContract._id,
          ownerId,
          month: currentMonth,
          year: currentYear,
        })
          .select("status salaryForDay")
          .lean(),
        Payment.find({
          contractId: activeContract._id,
          status: "paid",
        })
          .sort({ ownerPaidAt: -1, createdAt: -1 })
          .lean(),
      ]);

      // Single-pass attendance summary (O(n) instead of O(3n))
      const summary = {
        presentDays: 0,
        absentDays: 0,
        halfDays: 0,
        grossTotal: 0,
      };
      for (const r of ownerRecords) {
        if (r.status === "present") summary.presentDays += 1;
        else if (r.status === "absent") summary.absentDays += 1;
        else if (r.status === "half_day") summary.halfDays += 1;
        summary.grossTotal += Number(r.salaryForDay) || 0;
      }
      attendanceSummary = summary;

      paymentSummary = {
        totalPaid: payments.reduce(
          (sum, p) => sum + (Number(p.netAmount) || 0),
          0
        ),
        lastPayment: payments[0] || null,
      };
    }

    return res.json({
      success: true,
      driver,
      profile,
      activeContract,
      contractHistory,
      ratings,
      avgRating: calcAvgRating(ratings),
      totalRatings: ratings.length,
      attendanceSummary,
      paymentSummary,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

module.exports = {
  getOwnerProfile,
  updateOwnerProfile,
  uploadProfilePhoto,
  addVehicle,
  getVehicles,
  getVehicleDetail,
  getDriverDetail,
  deleteVehicle,
  getPublicOwnerProfile,
};
