const mongoose = require("mongoose");
const Contract = require("../models/Contract");
const ResignLetter = require("../models/ResignLetter");
const Notification = require("../models/Notification");
const Application = require("../models/Application");
const Job = require("../models/Job");
const Vehicle = require("../models/Vehicle");

// Constants
const MAX_REASON_LENGTH = 2000;
const MAX_RESPONSE_LENGTH = 1000;
const ALLOWED_ACTIONS = ["approved", "rejected"];

const uid = (req) => req.user._id || req.user.id;

// Helpers
const sendServerError = (res) => {
  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Server error'
      : undefined,
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

const requestResign = async (req, res) => {
  try {
    const { reason, lastWorkingDate } = req.body;

    if (!reason || !lastWorkingDate) {
      return res.status(400).json({
        success: false,
        message: "Reason aur last working date required hai",
      });
    }

    // Validate reason length
    const reasonTrim = String(reason).trim();
    if (reasonTrim.length < 5) {
      return res.status(400).json({
        success: false,
        message: "Reason kam se kam 5 characters ka hona chahiye",
      });
    }
    if (reasonTrim.length > MAX_REASON_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Reason ${MAX_REASON_LENGTH} characters se kam hona chahiye`,
      });
    }

    // Validate lastWorkingDate
    const lwd = new Date(lastWorkingDate);
    if (isNaN(lwd.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Last working date sahi nahi hai",
      });
    }

    // Last working date should not be in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (lwd < today) {
      return res.status(400).json({
        success: false,
        message: "Last working date past mein nahi ho sakti",
      });
    }

    // Find active contract
    const contract = await Contract.findOne({
      driverId: uid(req),
      status: "active",
    })
      .populate("ownerId", "name")
      .lean();

    if (!contract) {
      return res.status(400).json({
        success: false,
        message: "Koi active contract nahi",
      });
    }

    // Check existing pending resign
    const existing = await ResignLetter.findOne({
      contractId: contract._id,
      status: "pending",
    })
      .select("_id")
      .lean();

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Resign request pehle se pending hai",
      });
    }

    const ownerRef = contract.ownerId?._id || contract.ownerId;

    const resign = await ResignLetter.create({
      contractId: contract._id,
      driverId: uid(req),
      ownerId: ownerRef,
      reason: reasonTrim,
      lastWorkingDate: lwd,
      status: "pending",
    });

    // Non-blocking notification
    createNotificationSafe({
      userId: ownerRef,
      title: "Resign Request",
      message: `${req.user.name} sent a resign request. Please approve or reject.`,
      type: "complaint_update",
      link: "/owner/drivers",
      isRead: false,
    });

    return res.json({
      success: true,
      resign,
      message: "Resign request bhej di!",
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const handleResign = async (req, res) => {
  try {
    const { resignId, action, response } = req.body;

    // Basic validation
    if (!resignId || !action) {
      return res.status(400).json({
        success: false,
        message: "resignId aur action required",
      });
    }

    // ObjectId validation
    if (!isValidObjectId(resignId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid resign ID",
      });
    }

    // Action validation
    if (!ALLOWED_ACTIONS.includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action approved ya rejected hona chahiye",
      });
    }

    // Response length validation
    const respText = String(response || "").slice(0, MAX_RESPONSE_LENGTH);

    if (action === "rejected" && !respText.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reject karne ke liye response required hai",
      });
    }

    // Get resign with populated contract+driver (need contract jobId)
    const resign = await ResignLetter.findById(resignId)
      .populate("driverId", "name")
      .populate("contractId", "jobId ownerId");

    if (!resign) {
      return res.status(404).json({
        success: false,
        message: "Resign request nahi mili",
      });
    }

    // Authorization check
    if (String(resign.ownerId) !== String(uid(req))) {
      return res.status(403).json({
        success: false,
        message: "Access nahi hai",
      });
    }

    // Update resign
    resign.status = action;
    resign.ownerResponse = respText;

    const driverIdRef = resign.driverId._id;
    const driverName = resign.driverId.name;

    if (action === "approved") {
      const contractId = resign.contractId?._id || resign.contractId;
      const jobId = resign.contractId?.jobId;

      // Get job WITH vehicleId in one query (need vehicle info)
      const job = jobId
        ? await Job.findById(jobId).select("vehicleId").lean()
        : null;

      // Get vehicle info if exists (need for notification)
      const vehicle = job?.vehicleId
        ? await Vehicle.findById(job.vehicleId)
            .select("vehicleType vehicleNumber")
            .lean()
        : null;

      // PARALLEL - all updates at once (5x faster!)
      await Promise.all([
        resign.save(),
        Contract.findByIdAndUpdate(contractId, {
          status: "terminated",
        }),
        jobId
          ? Application.findOneAndUpdate(
              { jobId, driverId: driverIdRef },
              { status: "terminated" }
            )
          : Promise.resolve(null),
        jobId
          ? Job.findByIdAndUpdate(jobId, {
              status: "open",
              hiredDriver: null,
            })
          : Promise.resolve(null),
        job?.vehicleId
          ? Vehicle.findByIdAndUpdate(job.vehicleId, {
              assignedDriver: null,
            })
          : Promise.resolve(null),
      ]);

      // Non-blocking notifications
      if (vehicle) {
        createNotificationSafe({
          userId: uid(req),
          title: "Driver Needed",
          message: `${driverName} resigned. Your ${vehicle.vehicleType || "vehicle"} (${vehicle.vehicleNumber || ""}) has no driver assigned. Please hire a new driver.`,
          type: "new_application",
          link: "/owner/drivers",
          isRead: false,
        });
      }

      createNotificationSafe({
        userId: driverIdRef,
        title: "Resign Approved",
        message:
          "Your resign request was approved. You can look for new work now.",
        type: "complaint_update",
        link: "/driver/active-job",
        isRead: false,
      });
    } else {
      // Rejected - just save resign
      await resign.save();

      createNotificationSafe({
        userId: driverIdRef,
        title: "Resign Rejected",
        message: `Your resign request was rejected. ${respText}`,
        type: "complaint_update",
        link: "/driver/active-job",
        isRead: false,
      });
    }

    return res.json({
      success: true,
      message: `Resign ${action} ho gayi`,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getResignRequests = async (req, res) => {
  try {
    const query =
      req.user.role === "driver"
        ? { driverId: uid(req) }
        : { ownerId: uid(req) };

    const resigns = await ResignLetter.find(query)
      .populate("driverId", "name phone")
      .populate("ownerId", "name phone")
      .populate(
        "contractId",
        "salaryPerDay salaryPerMonth vehicleCategory"
      )
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, resigns });
  } catch (error) {
    return sendServerError(res);
  }
};

module.exports = {
  requestResign,
  handleResign,
  getResignRequests,
};
