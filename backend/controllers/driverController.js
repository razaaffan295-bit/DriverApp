const mongoose = require("mongoose");
const DriverProfile = require("../models/DriverProfile");
const User = require("../models/User");
const Job = require("../models/Job");
const Application = require("../models/Application");
const Contract = require("../models/Contract");
const Rating = require("../models/Rating");
const DriverInvite = require("../models/DriverInvite");

// Constants
const PAGE_LIMIT = 10;
const MAX_PAGE = 1000;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PHONE_REGEX = /^\d{10}$/;

const driverIdFromReq = (req) => req.user._id || req.user.id;

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

// Validate ObjectId format
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
};

const isSubscriptionActive = (user) => {
  if (user.isPermanentFree) return true;
  if (!user.subscriptionRequired) return true;
  if (
    user.subscription?.isActive === true &&
    user.subscription?.endDate &&
    new Date(user.subscription.endDate) > new Date()
  )
    return true;
  return false;
};

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

    // Parallel - 2x faster
    const [user, profile] = await Promise.all([
      User.findById(driverId).select("-password").lean(),
      DriverProfile.findOne({ driverId }).lean(),
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
    const driverId = driverIdFromReq(req);

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

    await User.findByIdAndUpdate(driverId, {
      profilePhoto: photoUrl,
    });

    return res.json({
      success: true,
      message: "Photo upload ho gayi!",
      photo: photoUrl,
    });
  } catch (error) {
    return sendServerError(res);
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

    // Input length validations
    if (name !== undefined) {
      const nameTrim = String(name).trim();
      if (nameTrim.length < 1 || nameTrim.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Naam 1 se 100 characters ka hona chahiye",
        });
      }
    }
    if (about !== undefined && String(about).length > 1000) {
      return res.status(400).json({
        success: false,
        message: "About 1000 characters se kam hona chahiye",
      });
    }
    if (licenseNumber !== undefined && String(licenseNumber).length > 50) {
      return res.status(400).json({
        success: false,
        message: "License number 50 characters se kam hona chahiye",
      });
    }
    if (experience !== undefined && experience !== "") {
      const expNum = Number(experience);
      if (!Number.isFinite(expNum) || expNum < 0 || expNum > 70) {
        return res.status(400).json({
          success: false,
          message: "Experience 0 se 70 saal ke beech hona chahiye",
        });
      }
    }

    // Bank details validations
    if (bankDetails && typeof bankDetails === "object") {
      if (bankDetails.ifscCode !== undefined && bankDetails.ifscCode !== "") {
        const ifsc = String(bankDetails.ifscCode).trim().toUpperCase();
        if (!IFSC_REGEX.test(ifsc)) {
          return res.status(400).json({
            success: false,
            message: "IFSC code galat hai (e.g. SBIN0001234)",
          });
        }
      }
      if (bankDetails.accountNumber !== undefined && bankDetails.accountNumber !== "") {
        const acc = String(bankDetails.accountNumber).trim();
        if (!/^\d{9,18}$/.test(acc)) {
          return res.status(400).json({
            success: false,
            message: "Account number 9 se 18 digits ka hona chahiye",
          });
        }
      }
      if (bankDetails.accountName !== undefined && String(bankDetails.accountName).length > 200) {
        return res.status(400).json({
          success: false,
          message: "Account name 200 characters se kam hona chahiye",
        });
      }
      if (bankDetails.upiId !== undefined && String(bankDetails.upiId).length > 100) {
        return res.status(400).json({
          success: false,
          message: "UPI ID 100 characters se kam hona chahiye",
        });
      }
    }

    const user = await User.findById(driverId);
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
    let profile = await DriverProfile.findOne({ driverId });
    if (!profile) {
      profile = new DriverProfile({
        driverId,
        skills: [],
        isProfileComplete: true,
      });
    }

    // Update profile fields
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

    // Save both in parallel - 2x faster
    await Promise.all([
      user.save(),
      profile.save(),
    ]);

    // Return profile from memory (no extra DB query)
    return res.json({
      success: true,
      profile: profile.toObject ? profile.toObject() : profile,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const searchJobs = async (req, res) => {
  try {
    const { state, vehicleType, page = "1" } = req.query;
    const filter = { status: "open" };

    // Sanitize string inputs (prevent injection)
    if (state) {
      const s = String(state).trim().slice(0, 100);
      if (s) filter["location.state"] = s;
    }
    if (vehicleType) {
      const v = String(vehicleType).trim().slice(0, 100);
      if (v) filter.vehicleType = v;
    }

    // Pagination with max limit
    const p = Math.min(MAX_PAGE, Math.max(1, parseInt(page, 10) || 1));
    const skip = (p - 1) * PAGE_LIMIT;

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .populate("ownerId", "name location")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(PAGE_LIMIT)
        .lean(),
      Job.countDocuments(filter),
    ]);

    const ownerIds = jobs
      .map((job) => job.ownerId?._id || job.ownerId)
      .filter(Boolean);
    const ratingsData =
      ownerIds.length > 0
        ? await Rating.aggregate([
            { $match: { ratedTo: { $in: ownerIds } } },
            {
              $group: {
                _id: "$ratedTo",
                avgRating: { $avg: "$score" },
                count: { $sum: 1 },
              },
            },
          ])
        : [];
    const ratingsMap = {};
    ratingsData.forEach((r) => {
      ratingsMap[String(r._id)] = {
        avgRating: r.avgRating,
        count: r.count,
      };
    });

    const jobsWithRating = jobs.map((job) => {
        const oid = job.ownerId?._id || job.ownerId;
        if (!oid) {
          return job;
        }
        const hit = ratingsMap[String(oid)];
        const totalRatings = hit ? hit.count : 0;
        const avgRating =
          totalRatings > 0
            ? Number(hit.avgRating).toFixed(1)
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
    });

    return res.json({
      success: true,
      jobs: jobsWithRating,
      total,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getJobDetail = async (req, res) => {
  try {
    const driverId = driverIdFromReq(req);
    const jobId = req.params.id;

    // Validate ObjectId
    if (!isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID",
      });
    }

    // Parallel - 2x faster
    const [job, applicationDoc] = await Promise.all([
      Job.findOne({
        _id: jobId,
        status: "open",
      })
        .populate("ownerId", "name phone location")
        .lean(),
      Application.findOne({
        jobId,
        driverId,
      })
        .select("_id")
        .lean(),
    ]);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job nahi mili ya band ho chuki hai",
      });
    }

    return res.json({
      success: true,
      job,
      hasApplied: !!applicationDoc,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const applyJob = async (req, res) => {
  try {
    const driverId = driverIdFromReq(req);
    const jobId = req.params.id;

    // Validate ObjectId
    if (!isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID",
      });
    }

    // Parallel - 4 queries at once = 4x faster
    const [driverUser, job, existing, activeContract] = await Promise.all([
      User.findById(driverId)
        .select("subscription isPermanentFree subscriptionRequired")
        .lean(),
      Job.findOne({ _id: jobId, status: "open" }).lean(),
      Application.findOne({ jobId, driverId }).select("_id").lean(),
      Contract.findOne({ driverId, status: "active" }).select("_id").lean(),
    ]);

    // Validation checks
    if (!driverUser) {
      return res.status(401).json({
        success: false,
        message: "User nahi mila",
      });
    }
    if (!isSubscriptionActive(driverUser)) {
      return res.status(403).json({
        success: false,
        message:
          "Job apply karne ke liye active subscription chahiye (₹99/month).",
        code: "SUBSCRIPTION_REQUIRED",
      });
    }
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job nahi mili ya ab open nahi hai",
      });
    }
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Aap pehle se apply kar chuke hain",
      });
    }
    if (activeContract) {
      return res.status(400).json({
        success: false,
        message:
          "Aapka ek kaam already chal raha hai. Pehle resign karein.",
      });
    }

    // Create application + update job in parallel
    const [application] = await Promise.all([
      Application.create({
        jobId: job._id,
        driverId,
        ownerId: job.ownerId,
        status: "pending",
      }),
      Job.updateOne(
        { _id: job._id },
        { $addToSet: { applicants: driverId } }
      ),
    ]);

    return res.status(201).json({
      success: true,
      application,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getPublicDriverProfile = async (req, res) => {
  try {
    const ownerId = req.user._id || req.user.id;
    const userRole = req.user.role;
    const targetDriverId = req.params.id;

    // Validate ObjectId
    if (!isValidObjectId(targetDriverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid driver ID",
      });
    }

    // Authorization check
    if (String(ownerId) !== String(targetDriverId)) {
      if (userRole === "admin") {
        // allow
      } else if (userRole === "owner") {
        const [app, contract, invite] = await Promise.all([
          Application.findOne({
            ownerId,
            driverId: targetDriverId,
          }).select("_id").lean(),
          Contract.findOne({
            ownerId,
            driverId: targetDriverId,
          }).select("_id").lean(),
          DriverInvite.findOne({
            ownerId,
            driverId: targetDriverId,
          }).select("_id").lean(),
        ]);

        if (!app && !contract && !invite) {
          return res.status(403).json({
            success: false,
            message:
              "You need to invite or have application from this driver first",
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    }

    // Parallel - 4 queries at once = 4x faster
    const [user, profileDoc, ratings, completedJobs] = await Promise.all([
      User.findById(targetDriverId)
        .select("_id name location isVerified profilePhoto role createdAt")
        .lean(),
      DriverProfile.findOne({ driverId: targetDriverId })
        .select(
          "skills experience licenseNumber licenseType licenseExpiry about isProfileComplete documents"
        )
        .lean(),
      Rating.find({ ratedTo: targetDriverId })
        .select("score review createdAt")
        .populate("ratedBy", "name")
        .lean(),
      Contract.countDocuments({
        driverId: targetDriverId,
        status: "completed",
      }),
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Driver nahi mila",
      });
    }

    return res.json({
      success: true,
      user,
      profile: profileDoc || {},
      ratings: ratings || [],
      avgRating: calcAvgRating(ratings),
      totalRatings: ratings.length,
      completedJobs,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const uploadDocuments = async (req, res) => {
  try {
    const driverId = driverIdFromReq(req);

    let profile = await DriverProfile.findOne({ driverId });

    if (!profile) {
      profile = new DriverProfile({
        driverId,
        skills: [],
      });
    }

    const fileUrl = (f) =>
      f?.path || f?.secure_url || f?.url || "";

    const docs = {};
    const DOC_FIELDS = ["license", "aadhar", "photo", "other"];

    for (const field of DOC_FIELDS) {
      if (req.files?.[field]?.[0]) {
        const u = fileUrl(req.files[field][0]);
        if (u) docs[field] = u;
      }
    }

    if (Object.keys(docs).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Koi valid file upload nahi hui",
      });
    }

    const prev =
      profile.documents &&
      typeof profile.documents.toObject === "function"
        ? profile.documents.toObject()
        : { ...(profile.documents || {}) };
    profile.documents = { ...prev, ...docs };

    await profile.save();

    return res.json({
      success: true,
      message: "Documents upload ho gaye!",
      documents: profile.documents,
    });
  } catch (error) {
    return sendServerError(res);
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
    return sendServerError(res);
  }
};

module.exports = {
  getPublicDriverProfile,
  getDriverProfile,
  updateDriverProfile,
  uploadProfilePhoto,
  uploadDocuments,
  searchJobs,
  getJobDetail,
  applyJob,
  getDriverApplications,
};
