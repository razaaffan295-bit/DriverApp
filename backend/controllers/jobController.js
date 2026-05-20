const mongoose = require("mongoose");
const Job = require("../models/Job");
const Vehicle = require("../models/Vehicle");
const User = require("../models/User");

// Constants
const ALLOWED_CATEGORIES = ["mining", "road", "transport"];
const ALLOWED_SALARY_TYPES = ["daily", "monthly", "hourly"];
const ALLOWED_TRANSPORT_TYPES = ["company_trip", "malik_trip", "none"];

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_LOCATION_FIELD_LENGTH = 200;
const MAX_VEHICLE_TYPE_LENGTH = 100;
const MAX_SALARY = 1000000;
const MAX_DURATION_DAYS = 1825;
const MIN_DURATION_DAYS = 1;

const PAGE_LIMIT = 50;
const MAX_PAGE = 1000;

const ownerIdFromReq = (req) => req.user._id || req.user.id;

// Helper for consistent 500 responses
const sendServerError = (res) => {
  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Server error'
      : undefined,
  });
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

const createJob = async (req, res) => {
  try {
    const oid = ownerIdFromReq(req);

    const {
      title,
      description,
      vehicleType,
      vehicleId,
      location,
      salaryPerDay,
      salaryPerMonth,
      salaryPerHour,
      salaryType,
      vehicleCategory,
      dailyBhatta,
      hasBhatta,
      hasHourlyBonus,
      transportType,
      duration,
      startDate,
    } = req.body;

    // Validate vehicleId format FIRST (before DB queries)
    if (!vehicleId || !isValidObjectId(vehicleId)) {
      return res.status(400).json({
        success: false,
        message: "Vehicle ID galat hai",
      });
    }

    // Parallel queries - 2x faster
    const [ownerUser, vehicle] = await Promise.all([
      User.findById(oid)
        .select("subscription isPermanentFree subscriptionRequired")
        .lean(),
      Vehicle.findOne({
        _id: vehicleId,
        ownerId: oid,
      }).lean(),
    ]);

    if (!ownerUser) {
      return res.status(401).json({
        success: false,
        message: "User nahi mila",
      });
    }
    if (!isSubscriptionActive(ownerUser)) {
      return res.status(403).json({
        success: false,
        message:
          "Job post karne ke liye active subscription chahiye (₹499/month).",
        code: "SUBSCRIPTION_REQUIRED",
      });
    }
    if (!vehicle) {
      return res.status(400).json({
        success: false,
        message: "Yeh gadi aapki nahi hai ya valid nahi hai",
      });
    }

    const loc = location && typeof location === "object" ? location : null;
    const reqState = loc?.state;
    const reqDistrict = loc?.district;
    const reqCity = loc?.city;
    const reqAddress = loc?.address;

    const missing =
      !vehicleType ||
      !title ||
      !description ||
      !reqState ||
      !reqDistrict ||
      !reqCity ||
      !reqAddress ||
      duration === undefined ||
      duration === "" ||
      !startDate ||
      !vehicleId;

    if (missing) {
      return res.status(400).json({
        success: false,
        message: "Sab required fields bhariye",
      });
    }

    // Input length validations
    if (String(title).length > MAX_TITLE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Title ${MAX_TITLE_LENGTH} characters se kam hona chahiye`,
      });
    }
    if (String(description).length > MAX_DESCRIPTION_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Description ${MAX_DESCRIPTION_LENGTH} characters se kam hona chahiye`,
      });
    }
    if (String(vehicleType).length > MAX_VEHICLE_TYPE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: "Vehicle type bahut lamba hai",
      });
    }
    if (
      String(reqState).length > MAX_LOCATION_FIELD_LENGTH ||
      String(reqDistrict).length > MAX_LOCATION_FIELD_LENGTH ||
      String(reqCity).length > MAX_LOCATION_FIELD_LENGTH ||
      String(reqAddress).length > MAX_LOCATION_FIELD_LENGTH
    ) {
      return res.status(400).json({
        success: false,
        message: "Location fields bahut lambe hain",
      });
    }

    // Start date validation - not in past
    const startDateObj = new Date(startDate);
    if (isNaN(startDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Start date sahi nahi hai",
      });
    }

    // Allow start date up to 2 years in future
    const maxFutureDate = new Date();
    maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 2);
    if (startDateObj > maxFutureDate) {
      return res.status(400).json({
        success: false,
        message: "Start date 2 saal se zyada future mein nahi ho sakti",
      });
    }

    const cat = vehicleCategory ? String(vehicleCategory) : "mining";
    const st = salaryType ? String(salaryType) : "daily";
    const tt = transportType ? String(transportType) : "none";

    // Use constants for validation
    if (!ALLOWED_CATEGORIES.includes(cat)) {
      return res.status(400).json({
        success: false,
        message: "Vehicle category invalid hai",
      });
    }
    if (!ALLOWED_SALARY_TYPES.includes(st)) {
      return res.status(400).json({
        success: false,
        message: "Salary type invalid hai",
      });
    }
    if (!ALLOWED_TRANSPORT_TYPES.includes(tt)) {
      return res.status(400).json({
        success: false,
        message: "Transport type invalid hai",
      });
    }
    if (cat === "transport" && st !== "monthly") {
      return res.status(400).json({
        success: false,
        message: "Transport category ke liye salary type monthly hona chahiye",
      });
    }
    if (cat === "transport" && tt === "none") {
      return res.status(400).json({
        success: false,
        message: "Transport category ke liye trip type required hai",
      });
    }

    const salaryDayNum =
      salaryPerDay === undefined || salaryPerDay === "" ? undefined : Number(salaryPerDay);
    const salaryMonthNum =
      salaryPerMonth === undefined || salaryPerMonth === "" ? undefined : Number(salaryPerMonth);
    const salaryHourNum =
      salaryPerHour === undefined || salaryPerHour === "" ? undefined : Number(salaryPerHour);

    // Salary validations with upper bound
    if (st === "daily") {
      if (!Number.isFinite(salaryDayNum) || salaryDayNum < 0) {
        return res.status(400).json({
          success: false,
          message: "Salary per day valid number honi chahiye",
        });
      }
      if (salaryDayNum > MAX_SALARY) {
        return res.status(400).json({
          success: false,
          message: `Salary per day ₹${MAX_SALARY} se zyada nahi ho sakti`,
        });
      }
    }
    if (st === "monthly") {
      if (!Number.isFinite(salaryMonthNum) || salaryMonthNum < 0) {
        return res.status(400).json({
          success: false,
          message: "Salary per month valid number honi chahiye",
        });
      }
      if (salaryMonthNum > MAX_SALARY) {
        return res.status(400).json({
          success: false,
          message: `Salary per month ₹${MAX_SALARY} se zyada nahi ho sakti`,
        });
      }
    }
    if (st === "hourly") {
      if (!Number.isFinite(salaryHourNum) || salaryHourNum < 0) {
        return res.status(400).json({
          success: false,
          message: "Salary per hour valid number honi chahiye",
        });
      }
      if (salaryHourNum > MAX_SALARY) {
        return res.status(400).json({
          success: false,
          message: `Salary per hour ₹${MAX_SALARY} se zyada nahi ho sakti`,
        });
      }
    }

    // Daily bhatta validation
    if (dailyBhatta !== undefined && dailyBhatta !== "") {
      const bhattaNum = Number(dailyBhatta);
      if (!Number.isFinite(bhattaNum) || bhattaNum < 0 || bhattaNum > MAX_SALARY) {
        return res.status(400).json({
          success: false,
          message: "Daily bhatta valid amount honi chahiye",
        });
      }
    }

    // Duration validation with upper bound
    const durationNum = Number(duration);
    if (!Number.isFinite(durationNum) || durationNum < MIN_DURATION_DAYS) {
      return res.status(400).json({
        success: false,
        message: `Duration kam se kam ${MIN_DURATION_DAYS} din honi chahiye`,
      });
    }
    if (durationNum > MAX_DURATION_DAYS) {
      return res.status(400).json({
        success: false,
        message: `Duration ${MAX_DURATION_DAYS} din se zyada nahi ho sakti`,
      });
    }

    const bhattaAllowed = cat === "mining" || cat === "road";

    const job = await Job.create({
      ownerId: oid,
      vehicleId: vehicle._id,
      vehicleType: String(vehicleType).trim(),
      title: String(title).trim(),
      description: String(description).trim(),
      location: {
        state: String(reqState).trim(),
        district: String(reqDistrict).trim(),
        city: String(reqCity).trim(),
        address: String(reqAddress).trim(),
      },
      vehicleCategory: cat,
      salaryType: st,
      salaryPerDay: Number(salaryPerDay) || 0,
      salaryPerMonth: Number(salaryPerMonth) || 0,
      salaryPerHour: Number(salaryPerHour) || 0,
      dailyBhatta: bhattaAllowed ? Number(dailyBhatta) || 0 : 0,
      hasBhatta: bhattaAllowed ? Boolean(hasBhatta) || false : false,
      hasHourlyBonus:
        cat !== "transport" && st !== "hourly"
          ? Boolean(hasHourlyBonus) || false
          : false,
      transportType: cat === "transport" ? tt : "none",
      duration: durationNum,
      startDate: new Date(startDate),
      status: "open",
    });

    return res.status(201).json({
      success: true,
      job,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getOwnerJobs = async (req, res) => {
  try {
    const oid = ownerIdFromReq(req);
    const { page = "1" } = req.query;

    // Pagination with max limit
    const p = Math.min(MAX_PAGE, Math.max(1, parseInt(page, 10) || 1));
    const skip = (p - 1) * PAGE_LIMIT;

    // Parallel - get jobs + total count
    const [jobs, total] = await Promise.all([
      Job.find({ ownerId: oid })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(PAGE_LIMIT)
        .lean(),
      Job.countDocuments({ ownerId: oid }),
    ]);

    return res.json({
      success: true,
      jobs,
      total,
      page: p,
      hasMore: skip + jobs.length < total,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getJobById = async (req, res) => {
  try {
    const oid = ownerIdFromReq(req);
    const jobId = req.params.id;

    // Validate ObjectId
    if (!isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID",
      });
    }

    const job = await Job.findById(jobId)
      .populate("ownerId", "name phone")
      .lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job nahi mili",
      });
    }

    const jobOwnerId =
      job.ownerId && job.ownerId._id ? job.ownerId._id : job.ownerId;
    if (String(jobOwnerId) !== String(oid)) {
      return res.status(403).json({
        success: false,
        message: "Yeh aapki job nahi hai",
      });
    }

    return res.json({
      success: true,
      job,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const closeJob = async (req, res) => {
  try {
    const oid = ownerIdFromReq(req);
    const jobId = req.params.id;

    // Validate ObjectId
    if (!isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID",
      });
    }

    // Atomic update - 1 query (was 2)
    const job = await Job.findOneAndUpdate(
      { _id: jobId, ownerId: oid },
      { $set: { status: "closed" } },
      { new: true }
    ).lean();

    if (!job) {
      // Either job doesn't exist OR not owned by this owner
      const exists = await Job.exists({ _id: jobId });
      if (!exists) {
        return res.status(404).json({
          success: false,
          message: "Job nahi mili",
        });
      }
      return res.status(403).json({
        success: false,
        message: "Yeh aapki job nahi hai",
      });
    }

    return res.json({ success: true });
  } catch (error) {
    return sendServerError(res);
  }
};

module.exports = {
  createJob,
  getOwnerJobs,
  getJobById,
  closeJob,
};
