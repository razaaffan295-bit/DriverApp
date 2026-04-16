const Contract = require("../models/Contract");
const Application = require("../models/Application");
const Job = require("../models/Job");
const User = require("../models/User");
const Notification = require("../models/Notification");

const uidFromReq = (req) => req.user._id || req.user.id;

const createContract = async (req, res) => {
  try {
    const ownerId = uidFromReq(req);
    const { driverId, jobId, terms, safetyConditions } = req.body;

    if (!driverId || !jobId) {
      return res.status(400).json({
        success: false,
        message: "driverId aur jobId zaroori hain",
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

    const application = await Application.findOne({
      jobId,
      driverId,
      ownerId,
    });
    if (!application || application.status !== "accepted") {
      return res.status(400).json({
        success: false,
        message: "Pehle driver accept karein",
      });
    }

    const existing = await Contract.findOne({ jobId, driverId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Contract pehle se hai",
      });
    }

    const job = await Job.findById(jobId);
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
      terms: String(terms).trim(),
      safetyConditions: String(safetyConditions).trim(),
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

    const owner = await User.findById(ownerId).select("name");

    await Notification.create({
      userId: driverId,
      title: "Contract Sent",
      message: `${owner?.name || "Owner"} sent you a joining letter. Please review and sign it.`,
      type: "new_message",
      link: "/driver/active-job",
      isRead: false,
    });

    const populated = await Contract.findById(contract._id)
      .populate("jobId")
      .populate("driverId", "name phone location")
      .populate("ownerId", "name phone location");

    return res.status(201).json({
      success: true,
      contract: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
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
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const getContractById = async (req, res) => {
  try {
    const uid = uidFromReq(req);
    const contract = await Contract.findById(req.params.id)
      .populate(
        "jobId",
        "title vehicleType location salaryType vehicleCategory salaryPerDay salaryPerMonth salaryPerHour dailyBhatta hasHourlyBonus duration startDate"
      )
      .populate("ownerId", "name phone location")
      .populate("driverId", "name phone location");

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
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const driverSignContract = async (req, res) => {
  try {
    const driverId = uidFromReq(req);
    const contract = await Contract.findById(req.params.id);

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

    contract.driverSigned = true;
    contract.driverSignedAt = new Date();
    contract.status = "active";
    await contract.save();

    await Application.findOneAndUpdate(
      { jobId: contract.jobId, driverId: contract.driverId },
      { status: "active" }
    );

    const driver = await User.findById(driverId).select("name");

    await Notification.create({
      userId: contract.ownerId,
      title: "Contract Signed",
      message: `${driver?.name || "Driver"} signed the joining letter. Work can start now.`,
      type: "application_accepted",
      link: "/owner/applications",
      isRead: false,
    });

    const populated = await Contract.findById(contract._id)
      .populate("jobId")
      .populate("ownerId", "name phone location")
      .populate("driverId", "name phone location");

    return res.json({
      success: true,
      contract: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const completeContract = async (req, res) => {
  try {
    const ownerId = String(
      req.user._id || req.user.id
    );
    const contract = await Contract.findById(
      req.params.id
    ).populate("driverId", "name");

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

    await Notification.create({
      userId: contract.driverId._id,
      title: "Work Completed",
      message:
        "Your work was marked as completed. You can rate now.",
      type: "complaint_update",
      link: "/driver/ratings",
      isRead: false,
    });

    return res.json({
      success: true,
      message: "Contract complete ho gaya!",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
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
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
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
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

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
      .populate("driverId", "name phone location");

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
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
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
};
