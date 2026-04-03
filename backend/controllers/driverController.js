const DriverProfile = require("../models/DriverProfile");
const User = require("../models/User");
const Job = require("../models/Job");
const Application = require("../models/Application");
const Contract = require("../models/Contract");
const Rating = require("../models/Rating");

const driverIdFromReq = (req) => req.user._id || req.user.id;

const SKILL_ENUM = [
  "JCB",
  "Truck",
  "Dumper",
  "Crane",
  "Excavator",
  "Roller",
  "Poclain",
  "Other",
];

const getDriverProfile = async (req, res) => {
  try {
    const driverId = driverIdFromReq(req);
    const user = await User.findById(driverId).select("-password");
    const profile = await DriverProfile.findOne({ driverId }).lean();
    return res.json({
      success: true,
      profile: profile || null,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const updateDriverProfile = async (req, res) => {
  try {
    const driverId = driverIdFromReq(req);
    const {
      name,
      skills,
      experience,
      licenseNumber,
      licenseType,
      licenseExpiry,
      about,
      bankDetails,
      state,
      district,
      profilePhoto,
    } = req.body;

    const user = await User.findById(driverId);
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

    let profile = await DriverProfile.findOne({ driverId });
    if (!profile) {
      profile = await DriverProfile.create({
        driverId,
        skills: [],
        isProfileComplete: true,
      });
    }

    if (Array.isArray(skills)) {
      profile.skills = skills.filter((s) => SKILL_ENUM.includes(s));
    }
    if (experience !== undefined && experience !== "") {
      const n = Number(experience);
      profile.experience = Number.isNaN(n) ? profile.experience : n;
    }
    if (licenseNumber !== undefined) {
      profile.licenseNumber = String(licenseNumber).trim();
    }
    if (licenseType !== undefined) {
      profile.licenseType = licenseType;
    }
    if (licenseExpiry !== undefined && licenseExpiry !== "") {
      profile.licenseExpiry = new Date(licenseExpiry);
    }
    if (about !== undefined) {
      profile.about = String(about).trim();
    }
    if (bankDetails && typeof bankDetails === "object") {
      profile.bankDetails = profile.bankDetails || {};
      const b = bankDetails;
      if (b.accountName !== undefined) {
        profile.bankDetails.accountName = String(b.accountName).trim();
      }
      if (b.accountNumber !== undefined) {
        profile.bankDetails.accountNumber = String(b.accountNumber).trim();
      }
      if (b.ifscCode !== undefined) {
        profile.bankDetails.ifscCode = String(b.ifscCode).trim().toUpperCase();
      }
      if (b.upiId !== undefined) {
        profile.bankDetails.upiId = String(b.upiId).trim();
      }
      if (b.upiQrCode !== undefined) {
        profile.bankDetails.upiQrCode = String(b.upiQrCode || "").trim();
      }
    }

    profile.isProfileComplete = true;
    await profile.save();

    const updated = await DriverProfile.findById(profile._id).lean();
    return res.json({
      success: true,
      profile: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const searchJobs = async (req, res) => {
  try {
    const { state, vehicleType, page = "1" } = req.query;
    const filter = { status: "open" };
    if (state) {
      filter["location.state"] = String(state).trim();
    }
    if (vehicleType) {
      filter.vehicleType = String(vehicleType).trim();
    }

    const limit = 10;
    const p = Math.max(1, parseInt(page, 10) || 1);
    const skip = (p - 1) * limit;

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .populate("ownerId", "name location")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Job.countDocuments(filter),
    ]);

    const jobsWithRating = await Promise.all(
      jobs.map(async (job) => {
        const oid = job.ownerId?._id || job.ownerId;
        if (!oid) {
          return job;
        }
        const ratings = await Rating.find({
          ratedTo: oid,
        })
          .select("score")
          .lean();
        const totalRatings = ratings.length;
        const avgRating =
          totalRatings > 0
            ? (
                ratings.reduce(
                  (s, r) => s + (Number(r.score) || 0),
                  0
                ) / totalRatings
              ).toFixed(1)
            : 0;
        return {
          ...job,
          ownerId:
            job.ownerId && typeof job.ownerId === "object"
              ? {
                  ...job.ownerId,
                  avgRating,
                  totalRatings,
                }
              : job.ownerId,
        };
      })
    );

    return res.json({
      success: true,
      jobs: jobsWithRating,
      total,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const getJobDetail = async (req, res) => {
  try {
    const driverId = driverIdFromReq(req);
    const job = await Job.findOne({
      _id: req.params.id,
      status: "open",
    })
      .populate("ownerId", "name phone location")
      .lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job nahi mili ya band ho chuki hai",
      });
    }

    const hasApplied = !!(await Application.findOne({
      jobId: job._id,
      driverId,
    }).select("_id").lean());

    return res.json({
      success: true,
      job,
      hasApplied,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const applyJob = async (req, res) => {
  try {
    const driverId = driverIdFromReq(req);

    const driverUser = await User.findById(driverId).select("subscription");
    if (!driverUser) {
      return res.status(401).json({
        success: false,
        message: "User nahi mila",
      });
    }
    const subActive =
      driverUser.subscription?.isActive === true &&
      driverUser.subscription?.endDate &&
      new Date(driverUser.subscription.endDate) > new Date();
    if (!subActive) {
      return res.status(403).json({
        success: false,
        message:
          "Job apply karne ke liye active subscription chahiye (₹99/month).",
        code: "SUBSCRIPTION_REQUIRED",
      });
    }

    const job = await Job.findOne({
      _id: req.params.id,
      status: "open",
    });
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job nahi mili ya ab open nahi hai",
      });
    }

    const existing = await Application.findOne({
      jobId: job._id,
      driverId,
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Aap pehle se apply kar chuke hain",
      });
    }

    const activeContract = await Contract.findOne({
      driverId,
      status: "active",
    });
    if (activeContract) {
      return res.status(400).json({
        success: false,
        message:
          "Aapka ek kaam already chal raha hai. Pehle resign karein.",
      });
    }

    const application = await Application.create({
      jobId: job._id,
      driverId,
      ownerId: job.ownerId,
      status: "pending",
    });

    await Job.updateOne(
      { _id: job._id },
      { $addToSet: { applicants: driverId } }
    );

    return res.status(201).json({
      success: true,
      application,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const getPublicDriverProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "_id name location isVerified profilePhoto role createdAt"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Driver nahi mila",
      });
    }

    const profileDoc = await DriverProfile.findOne({
      driverId: req.params.id,
    })
      .select(
        "skills experience licenseNumber licenseType licenseExpiry about isProfileComplete"
      )
      .lean();

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

    const completedJobs = await Contract.countDocuments({
      driverId: req.params.id,
      status: "completed",
    });

    return res.json({
      success: true,
      user,
      profile: profileDoc || {},
      ratings: ratings || [],
      avgRating,
      totalRatings: ratings.length,
      completedJobs,
    });
  } catch (error) {
    console.error("getPublicDriverProfile error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const getDriverApplications = async (req, res) => {
  try {
    const driverId = driverIdFromReq(req);
    const applications = await Application.find({ driverId })
      .populate(
        "jobId",
        "title vehicleType location salaryPerDay duration salaryPerMonth vehicleCategory salaryType"
      )
      .populate("ownerId", "name location")
      .sort({ appliedAt: -1 })
      .lean();

    return res.json({
      success: true,
      applications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

module.exports = {
  getPublicDriverProfile,
  getDriverProfile,
  updateDriverProfile,
  searchJobs,
  getJobDetail,
  applyJob,
  getDriverApplications,
};
