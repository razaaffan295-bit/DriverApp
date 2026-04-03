const Job = require("../models/Job");
const Vehicle = require("../models/Vehicle");

const ownerIdFromReq = (req) => req.user._id || req.user.id;

const toBool = (v) => v === true || v === "true" || v === 1 || v === "1";

const createJob = async (req, res) => {
  try {
    const oid = ownerIdFromReq(req);
    // Subscription (Subscription model + status active, endDate > now):
    // Razorpay phase: block with "Pehle subscription lein — ₹499/month" if missing.
    // Testing: allow job post without subscription (PRD IMPORTANT).

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

    const loc = location && typeof location === "object" ? location : null;
    const reqState = state ?? loc?.state;
    const reqDistrict = district ?? loc?.district;
    const reqCity = city ?? loc?.city;
    const reqAddress = address ?? loc?.address;

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

    const vehicle = await Vehicle.findOne({
      _id: vehicleId,
      ownerId: oid,
    });
    if (!vehicle) {
      return res.status(400).json({
        success: false,
        message: "Yeh gadi aapki nahi hai ya valid nahi hai",
      });
    }

    const cat = vehicleCategory ? String(vehicleCategory) : "mining";
    const st = salaryType ? String(salaryType) : "daily";
    const tt = transportType ? String(transportType) : "none";

    const allowedCats = ["mining", "road", "transport"];
    const allowedSalaryTypes = ["daily", "monthly", "hourly"];
    const allowedTransportTypes = ["company_trip", "malik_trip", "none"];
    if (!allowedCats.includes(cat)) {
      return res.status(400).json({
        success: false,
        message: "Vehicle category invalid hai",
      });
    }
    if (!allowedSalaryTypes.includes(st)) {
      return res.status(400).json({
        success: false,
        message: "Salary type invalid hai",
      });
    }
    if (!allowedTransportTypes.includes(tt)) {
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

    if (st === "daily" && (salaryDayNum === undefined || Number.isNaN(salaryDayNum) || salaryDayNum < 0)) {
      return res.status(400).json({
        success: false,
        message: "Salary per day valid number honi chahiye",
      });
    }
    if (
      st === "monthly" &&
      (salaryMonthNum === undefined || Number.isNaN(salaryMonthNum) || salaryMonthNum < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Salary per month valid number honi chahiye",
      });
    }
    if (st === "hourly" && (salaryHourNum === undefined || Number.isNaN(salaryHourNum) || salaryHourNum < 0)) {
      return res.status(400).json({
        success: false,
        message: "Salary per hour valid number honi chahiye",
      });
    }

    const durationNum = Number(duration);
    if (Number.isNaN(durationNum) || durationNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Duration kam se kam 1 din honi chahiye",
      });
    }

    const bhattaNum = Number(dailyBhatta || 0);
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
      salaryPerDay: Number.isNaN(salaryDayNum) ? 0 : salaryDayNum || 0,
      salaryPerMonth: Number.isNaN(salaryMonthNum) ? 0 : salaryMonthNum || 0,
      salaryPerHour: Number.isNaN(salaryHourNum) ? 0 : salaryHourNum || 0,
      dailyBhatta: bhattaAllowed && !Number.isNaN(bhattaNum) ? bhattaNum : 0,
      hasBhatta: bhattaAllowed ? toBool(hasBhatta) : false,
      hasHourlyBonus: cat !== "transport" && st !== "hourly" ? toBool(hasHourlyBonus) : false,
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
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const getOwnerJobs = async (req, res) => {
  try {
    const oid = ownerIdFromReq(req);
    const jobs = await Job.find({ ownerId: oid }).sort({
      createdAt: -1,
    });
    return res.json({
      success: true,
      jobs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const getJobById = async (req, res) => {
  try {
    const oid = ownerIdFromReq(req);
    const job = await Job.findById(req.params.id).populate(
      "ownerId",
      "name phone"
    );
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
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const closeJob = async (req, res) => {
  try {
    const oid = ownerIdFromReq(req);
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job nahi mili",
      });
    }
    if (String(job.ownerId) !== String(oid)) {
      return res.status(403).json({
        success: false,
        message: "Yeh aapki job nahi hai",
      });
    }
    job.status = "closed";
    await job.save();
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

module.exports = {
  createJob,
  getOwnerJobs,
  getJobById,
  closeJob,
};
