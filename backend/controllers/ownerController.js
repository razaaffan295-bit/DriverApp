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

const getOwnerProfile = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const user = await User.findById(ownerId).select("-password");
    const profile = await OwnerProfile.findOne({ ownerId }).lean();

    if (!profile) {
      return res.json({
        success: true,
        profile: null,
        user,
      });
    }

    return res.json({
      success: true,
      profile,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
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

    await User.findByIdAndUpdate(ownerId, {
      profilePhoto: photoUrl,
    });

    await OwnerProfile.findOneAndUpdate(
      { ownerId },
      {
        $set: { profilePhoto: photoUrl },
        $setOnInsert: { ownerId, isProfileComplete: false },
      },
      { upsert: true, new: true }
    );

    return res.json({
      success: true,
      message: "Photo upload ho gayi!",
      photo: photoUrl,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
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

    const user = await User.findById(ownerId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila",
      });
    }

    if (name !== undefined) user.name = String(name).trim();
    if (state !== undefined || district !== undefined) {
      user.location = user.location || {};
      if (state !== undefined) user.location.state = String(state).trim();
      if (district !== undefined) user.location.district = String(district).trim();
    }
    if (profilePhoto !== undefined && profilePhoto !== "") {
      user.profilePhoto = String(profilePhoto).trim();
    }
    await user.save();

    let profile = await OwnerProfile.findOne({ ownerId });
    if (!profile) {
      profile = await OwnerProfile.create({
        ownerId,
        companyName: companyName != null ? String(companyName).trim() : "",
        about: about != null ? String(about).trim() : "",
        isProfileComplete: true,
      });
    } else {
      if (companyName !== undefined) profile.companyName = String(companyName).trim();
      if (about !== undefined) profile.about = String(about).trim();
      profile.isProfileComplete = true;
      await profile.save();
    }

    const updated = await OwnerProfile.findById(profile._id).lean();
    return res.json({
      success: true,
      profile: updated,
      user: await User.findById(ownerId).select("-password").lean(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
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

    const vehicle = await Vehicle.create({
      ownerId,
      vehicleType,
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
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const getVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({
      ownerId: req.user._id,
    }).populate("assignedDriver", "name phone");
    return res.json({
      success: true,
      vehicles,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const deleteVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
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
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const getPublicOwnerProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "_id name location isVerified profilePhoto role createdAt"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila",
      });
    }

    const profileDoc = await OwnerProfile.findOne({
      ownerId: req.params.id,
    })
      .select("companyName about isProfileComplete")
      .lean();

    const vehicles = await Vehicle.find({
      ownerId: req.params.id,
      isActive: true,
    }).select("vehicleType vehicleNumber vehicleModel location");

    const ratings = await Rating.find({ ratedTo: req.params.id })
      .select("score review createdAt")
      .populate("ratedBy", "name")
      .lean();

    const avgRating =
      ratings.length > 0
        ? (
            ratings.reduce(
              (sum, r) => sum + (Number(r.score) || 0),
              0
            ) / ratings.length
          ).toFixed(1)
        : 0;

    return res.json({
      success: true,
      user,
      profile: profileDoc || {},
      vehicles: vehicles || [],
      ratings: ratings || [],
      avgRating,
      totalRatings: ratings.length,
    });
  } catch (error) {
    console.error("getPublicOwnerProfile error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const getVehicleDetail = async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({
      _id: req.params.id,
      ownerId: req.user._id,
    }).populate(
      "assignedDriver",
      "name phone location profilePhoto isVerified"
    );

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Gadi nahi mili",
      });
    }

    const vehicleJobs = await Job.find({ vehicleId: vehicle._id })
      .select("_id")
      .lean();
    const vehicleJobIds = vehicleJobs.map((j) => j._id);

    const activeContract = await Contract.findOne({
      jobId: { $in: vehicleJobIds },
      status: "active",
    })
      .populate("driverId", "name phone location profilePhoto")
      .populate(
        "jobId",
        "title vehicleType vehicleCategory salaryType salaryPerDay salaryPerMonth salaryPerHour dailyBhatta hasBhatta hasHourlyBonus transportType"
      );

    const contractHistory = await Contract.find({
      jobId: { $in: vehicleJobIds },
      status: { $in: ["completed", "terminated"] },
    })
      .populate("driverId", "name phone")
      .populate("jobId", "title vehicleType")
      .sort({ createdAt: -1 })
      .limit(5);

    let driverRating = null;
    let ratingCount = 0;
    if (vehicle.assignedDriver) {
      const ratings = await Rating.find({
        ratedTo: vehicle.assignedDriver._id,
      }).select("score");
      ratingCount = ratings.length;
      driverRating =
        ratings.length > 0
          ? (
              ratings.reduce((sum, r) => sum + (Number(r.score) || 0), 0) /
              ratings.length
            ).toFixed(1)
          : 0;
    }

    return res.json({
      success: true,
      vehicle,
      activeContract,
      contractHistory,
      driverRating,
      ratingCount,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getDriverDetail = async (req, res) => {
  try {
    const driverId = req.params.id;

    const driver = await User.findById(driverId).select(
      "name phone location profilePhoto isVerified createdAt"
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver nahi mila",
      });
    }

    const profile = await DriverProfile.findOne({ driverId });

    const activeContract = await Contract.findOne({
      ownerId: req.user._id,
      driverId,
      status: "active",
    })
      .populate(
        "jobId",
        "title vehicleType vehicleCategory salaryType salaryPerDay salaryPerMonth salaryPerHour dailyBhatta hasBhatta hasHourlyBonus transportType startDate duration vehicleId"
      )
      .populate("driverId", "name phone location profilePhoto")
      .populate("ownerId", "name phone location profilePhoto");

    if (activeContract?.jobId?.vehicleId) {
      await activeContract.populate(
        "jobId.vehicleId",
        "vehicleType vehicleNumber"
      );
    }

    const contractHistory = await Contract.find({
      ownerId: req.user._id,
      driverId,
      status: { $in: ["completed", "terminated"] },
    })
      .populate("jobId", "title vehicleType vehicleId")
      .sort({ createdAt: -1 });

    for (const c of contractHistory) {
      if (c?.jobId?.vehicleId) {
        // eslint-disable-next-line no-await-in-loop
        await c.populate("jobId.vehicleId", "vehicleType vehicleNumber");
      }
    }

    const ratings = await Rating.find({ ratedTo: driverId })
      .populate("ratedBy", "name role")
      .populate("jobId", "title")
      .sort({ createdAt: -1 })
      .limit(5);

    const avgRating =
      ratings.length > 0
        ? (
            ratings.reduce((sum, r) => sum + (Number(r.score) || 0), 0) /
            ratings.length
          ).toFixed(1)
        : 0;

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    let attendanceSummary = null;
    if (activeContract) {
      const ownerRecords = await OwnerAttendance.find({
        contractId: activeContract._id,
        ownerId: req.user._id,
        month: currentMonth,
        year: currentYear,
      }).select("status salaryForDay");

      attendanceSummary = {
        presentDays: ownerRecords.filter((r) => r.status === "present").length,
        absentDays: ownerRecords.filter((r) => r.status === "absent").length,
        halfDays: ownerRecords.filter((r) => r.status === "half_day").length,
        grossTotal: ownerRecords.reduce(
          (sum, r) => sum + (Number(r.salaryForDay) || 0),
          0
        ),
      };
    }

    let paymentSummary = null;
    if (activeContract) {
      const payments = await Payment.find({
        contractId: activeContract._id,
        status: "paid",
      }).sort({ ownerPaidAt: -1, createdAt: -1 });

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
      avgRating,
      totalRatings: ratings.length,
      attendanceSummary,
      paymentSummary,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
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
