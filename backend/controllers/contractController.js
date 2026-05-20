const mongoose = require("mongoose");
const Contract = require("../models/Contract");
const Application = require("../models/Application");
const Job = require("../models/Job");
const User = require("../models/User");
const Notification = require("../models/Notification");

// Constants
const MAX_TERMS_LENGTH = 10000;
const MAX_SAFETY_LENGTH = 5000;
const RATABLE_STATUSES = ["sent", "active"];

const uidFromReq = (req) => req.user._id || req.user.id;

// Helpers
const sendServerError = (res) => {
  return res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production" ? "Server error" : undefined,
  });
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
};

const createNotificationSafe = (data) => {
  Notification.create(data).catch(() => {
    // Silent fail - non-blocking
  });
};

const createContract = async (req, res) => {
  try {
    const ownerId = uidFromReq(req);
    const { driverId, jobId, terms, safetyConditions } = req.body;

    // Required field checks
    if (!driverId || !jobId) {
      return res.status(400).json({
        success: false,
        message: "driverId aur jobId zaroori hain",
      });
    }

    // ObjectId validation
    if (!isValidObjectId(driverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid driver ID",
      });
    }
    if (!isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID",
      });
    }

    if (!terms || !String(terms).trim()) {
      return res.status(400).json({
        success: false,
        message: "Kaam ki shartein likhein",
      });
    }
    if (!safetyConditions || !String(safetyConditions).trim()) {
      return res.status(400).json({
        success: false,
        message: "Safety conditions likhein",
      });
    }

    const termsTrim = String(terms).trim();
    const safetyTrim = String(safetyConditions).trim();

    // Length limits (DOS protection)
    if (termsTrim.length > MAX_TERMS_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Terms ${MAX_TERMS_LENGTH} characters se kam hone chahiye`,
      });
    }
    if (safetyTrim.length > MAX_SAFETY_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Safety conditions ${MAX_SAFETY_LENGTH} characters se kam hone chahiye`,
      });
    }

    // PARALLEL - 4 queries at once (4x faster!)
    const [existingActive, application, existing, job] = await Promise.all([
      Contract.findOne({
        driverId,
        status: { $in: ["active", "sent"] },
      })
        .select("_id")
        .lean(),
      Application.findOne({
        jobId,
        driverId,
        ownerId,
      })
        .select("status")
        .lean(),
      Contract.findOne({ jobId, driverId })
        .select("_id")
        .lean(),
      Job.findById(jobId).lean(),
    ]);

    // Validation in order
    if (existingActive) {
      return res.status(400).json({
        success: false,
        message: "Driver already has an active or pending contract",
      });
    }

    if (!application || application.status !== "accepted") {
      return res.status(400).json({
        success: false,
        message: "Pehle driver accept karein",
      });
    }

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Contract pehle se hai",
      });
    }

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job nahi mili",
      });
    }
    if (String(job.ownerId) !== String(ownerId)) {
      return res.status(403).json({
        success: false,
        message: "Yeh aapki job nahi hai",
      });
    }

    const loc = job.location || {};
    const workLocation = [loc.address, loc.city, loc.district, loc.state]
      .filter(Boolean)
      .join(", ");

    const contract = await Contract.create({
      jobId,
      ownerId,
      driverId,
      terms: termsTrim,
      safetyConditions: safetyTrim,
      vehicleCategory: job.vehicleCategory || "mining",
      salaryType: job.salaryType || "monthly",
      salaryPerDay: job.salaryPerDay,
      salaryPerMonth: job.salaryPerMonth,
      salaryPerHour: job.salaryPerHour,
      dailyBhatta: job.dailyBhatta || 0,
      hasBhatta: Boolean(job.hasBhatta),
      hasHourlyBonus: Boolean(job.hasHourlyBonus),
      transportType: job.transportType || "none",
      startDate: job.startDate,
      duration: job.duration,
      workLocation: workLocation || "",
      status: "sent",
      driverSigned: false,
    });

    // PARALLEL - get owner + populate (2x faster)
    const [owner, populated] = await Promise.all([
      User.findById(ownerId).select("name").lean(),
      Contract.findById(contract._id)
        .populate("jobId")
        .populate("driverId", "name phone location")
        .populate("ownerId", "name phone location")
        .lean(),
    ]);

    // Non-blocking notification
    createNotificationSafe({
      userId: driverId,
      title: "Contract Sent",
      message: `${owner?.name || "Owner"} sent you a joining letter. Please review and sign it.`,
      type: "new_message",
      link: "/driver/active-job",
      isRead: false,
    });

    return res.status(201).json({
      success: true,
      contract: populated,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getOwnerContracts = async (req, res) => {
  try {
    const ownerId = uidFromReq(req);
    const contracts = await Contract.find({ ownerId })
      .populate(
        "jobId",
        "title vehicleType location salaryType vehicleCategory salaryPerDay salaryPerMonth salaryPerHour dailyBhatta hasHourlyBonus duration startDate"
      )
      .populate("driverId", "name phone location")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      contracts,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getContractById = async (req, res) => {
  try {
    const uid = uidFromReq(req);
    const contractId = req.params.id;

    if (!isValidObjectId(contractId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contract ID",
      });
    }

    const contract = await Contract.findById(contractId)
      .populate(
        "jobId",
        "title vehicleType location salaryType vehicleCategory salaryPerDay salaryPerMonth salaryPerHour dailyBhatta hasHourlyBonus duration startDate"
      )
      .populate("ownerId", "name phone location")
      .populate("driverId", "name phone location")
      .lean();

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract nahi mila",
      });
    }

    const oid = String(contract.ownerId._id || contract.ownerId);
    const did = String(contract.driverId._id || contract.driverId);
    if (String(uid) !== oid && String(uid) !== did) {
      return res.status(403).json({
        success: false,
        message: "Access nahi hai",
      });
    }

    return res.json({
      success: true,
      contract,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const driverSignContract = async (req, res) => {
  try {
    const driverId = uidFromReq(req);
    const contractId = req.params.id;

    if (!isValidObjectId(contractId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contract ID",
      });
    }

    const contract = await Contract.findById(contractId);

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract nahi mila",
      });
    }
    if (String(contract.driverId) !== String(driverId)) {
      return res.status(403).json({
        success: false,
        message: "Yeh aapka contract nahi hai",
      });
    }
    if (contract.status !== "sent") {
      return res.status(400).json({
        success: false,
        message: "Sign ke liye contract sent hona chahiye",
      });
    }

    const driverIdToCheck =
      contract.driverId._id || contract.driverId;

    const otherActive = await Contract.findOne({
      driverId: driverIdToCheck,
      status: "active",
      _id: { $ne: contract._id },
    })
      .select("_id")
      .lean();

    if (otherActive) {
      return res.status(400).json({
        success: false,
        message:
          "You already have an active contract. Complete or resign first.",
      });
    }

    contract.driverSigned = true;
    contract.driverSignedAt = new Date();
    contract.status = "active";

    // STEP 1: Save contract FIRST (must complete before populate)
    await contract.save();

    // STEP 2: NOW run parallel - application update + driver + populate (3x faster)
    const [, driver, populated] = await Promise.all([
      Application.findOneAndUpdate(
        { jobId: contract.jobId, driverId: contract.driverId },
        { status: "active" }
      ),
      User.findById(driverId).select("name").lean(),
      Contract.findById(contract._id)
        .populate("jobId")
        .populate("ownerId", "name phone location")
        .populate("driverId", "name phone location")
        .lean(),
    ]);

    // Non-blocking notification
    createNotificationSafe({
      userId: contract.ownerId,
      title: "Contract Signed",
      message: `${driver?.name || "Driver"} signed the joining letter. Work can start now.`,
      type: "application_accepted",
      link: "/owner/applications",
      isRead: false,
    });

    return res.json({
      success: true,
      contract: populated,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const completeContract = async (req, res) => {
  try {
    const ownerId = String(req.user._id || req.user.id);
    const contractId = req.params.id;

    if (!isValidObjectId(contractId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contract ID",
      });
    }

    const contract = await Contract.findById(contractId).populate(
      "driverId",
      "name"
    );

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract nahi mila",
      });
    }

    if (contract.ownerId.toString() !== ownerId) {
      return res.status(403).json({
        success: false,
        message: "Access nahi hai",
      });
    }

    if (contract.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Contract active nahi hai",
      });
    }

    contract.status = "completed";
    await contract.save();

    // Non-blocking notification
    createNotificationSafe({
      userId: contract.driverId._id,
      title: "Work Completed",
      message: "Your work was marked as completed. You can rate now.",
      type: "complaint_update",
      link: "/driver/ratings",
      isRead: false,
    });

    return res.json({
      success: true,
      message: "Contract complete ho gaya!",
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getDriverContracts = async (req, res) => {
  try {
    const driverId = uidFromReq(req);
    const contracts = await Contract.find({ driverId })
      .populate(
        "jobId",
        "title vehicleType location salaryType vehicleCategory salaryPerDay salaryPerMonth salaryPerHour dailyBhatta hasHourlyBonus duration startDate"
      )
      .populate("ownerId", "name phone location")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      contracts,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getDriverContractHistory = async (req, res) => {
  try {
    const driverId = uidFromReq(req);
    const contracts = await Contract.find({
      driverId,
      status: { $in: ["completed", "terminated"] },
    })
      .populate(
        "jobId",
        "title vehicleType location salaryType vehicleCategory salaryPerDay salaryPerMonth salaryPerHour dailyBhatta hasHourlyBonus duration startDate"
      )
      .populate("ownerId", "name phone location")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      contracts,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const startWork = async (req, res) => {
  try {
    const driverId = uidFromReq(req)
    const { startDate } = req.body
    const contractId = req.params.id

    if (!isValidObjectId(contractId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contract ID",
      })
    }
    
    const contract = await Contract.findById(contractId)
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract nahi mila",
      })
    }
    
    if (String(contract.driverId) !== String(driverId)) {
      return res.status(403).json({
        success: false,
        message: "Yeh aapka contract nahi hai",
      })
    }
    
    if (contract.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Contract active nahi hai",
      })
    }
    
    if (contract.workStartDate) {
      return res.status(400).json({
        success: false,
        message: "Kaam pehle se shuru ho chuka hai",
      })
    }
    
    // Validate start date
    let workDate = new Date()
    if (startDate) {
      const picked = new Date(startDate)
      if (isNaN(picked.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Date sahi nahi hai",
        })
      }
      
      // Not future
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      if (picked > today) {
        return res.status(400).json({
          success: false,
          message: "Future date nahi chal sakti",
        })
      }
      
      // Not before contract sign
      const signDate = contract.driverSignedAt || contract.createdAt
      const signDateStart = new Date(signDate)
      signDateStart.setHours(0, 0, 0, 0)
      if (picked < signDateStart) {
        return res.status(400).json({
          success: false,
          message: "Contract sign date se pehle nahi chal sakti",
        })
      }
      
      workDate = picked
    }
    
    workDate.setHours(0, 0, 0, 0)
    contract.workStartDate = workDate
    contract.workStartedAt = new Date()
    await contract.save()
    
    const driver = await User.findById(driverId).select("name")
    
    // Owner notification (fire and forget)
    const dateStr = workDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    
    createNotificationSafe({
      userId: contract.ownerId,
      title: "Driver Started Work",
      message: `${driver?.name || "Driver"} ne kaam shuru kiya - ${dateStr} se`,
      type: "application_accepted",
      link: "/owner/applications",
      isRead: false,
    })
    
    return res.json({
      success: true,
      contract: {
        _id: contract._id,
        workStartDate: contract.workStartDate,
        workStartedAt: contract.workStartedAt,
      },
      message: "Kaam shuru ho gaya!",
    })
  } catch (error) {
    return sendServerError(res)
  }
}

const getDriverContract = async (req, res) => {
  try {
    const driverId = uidFromReq(req);

    const contract = await Contract.findOne({
      driverId,
      status: { $in: ["sent", "active"] },
    })
      .sort({ createdAt: -1 })
      .populate(
        "jobId",
        "title vehicleType location salaryType vehicleCategory salaryPerDay salaryPerMonth salaryPerHour dailyBhatta hasHourlyBonus duration startDate"
      )
      .populate("ownerId", "name phone location")
      .populate("driverId", "name phone location")
      .lean();

    if (!contract) {
      return res.json({
        success: true,
        contract: null,
      });
    }

    return res.json({
      success: true,
      contract,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

module.exports = {
  createContract,
  getOwnerContracts,
  getContractById,
  driverSignContract,
  completeContract,
  getDriverContract,
  getDriverContracts,
  getDriverContractHistory,
  startWork,
};
