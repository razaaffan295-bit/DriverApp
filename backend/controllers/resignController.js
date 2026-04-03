const Contract = require("../models/Contract");
const ResignLetter = require("../models/ResignLetter");
const Notification = require("../models/Notification");

const uid = (req) => req.user._id || req.user.id;

const requestResign = async (req, res) => {
  try {
    const { reason, lastWorkingDate } = req.body;

    if (!reason || !lastWorkingDate) {
      return res.status(400).json({
        success: false,
        message: "Reason aur last working date required hai",
      });
    }

    const contract = await Contract.findOne({
      driverId: uid(req),
      status: "active",
    }).populate("ownerId", "name");

    if (!contract) {
      return res.status(400).json({
        success: false,
        message: "Koi active contract nahi",
      });
    }

    const existing = await ResignLetter.findOne({
      contractId: contract._id,
      status: "pending",
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Resign request pehle se pending hai",
      });
    }

    const resign = await ResignLetter.create({
      contractId: contract._id,
      driverId: uid(req),
      ownerId: contract.ownerId._id || contract.ownerId,
      reason: String(reason).trim(),
      lastWorkingDate: new Date(lastWorkingDate),
      status: "pending",
    });

    await Notification.create({
      userId: contract.ownerId._id || contract.ownerId,
      title: "Driver ne Resign Kiya!",
      message: `${req.user.name} ne resign request bheja hai. Approve ya reject karein.`,
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
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const handleResign = async (req, res) => {
  try {
    const { resignId, action, response } = req.body;

    const Application = require("../models/Application");
    const Job = require("../models/Job");
    const Vehicle = require("../models/Vehicle");

    if (!resignId || !action) {
      return res.status(400).json({
        success: false,
        message: "resignId aur action required",
      });
    }

    if (action !== "approved" && action !== "rejected") {
      return res.status(400).json({
        success: false,
        message: "Action approved ya rejected hona chahiye",
      });
    }
    if (action === "rejected" && (!response || !String(response).trim())) {
      return res.status(400).json({
        success: false,
        message: "Reject karne ke liye response required hai",
      });
    }

    const resign = await ResignLetter.findById(resignId)
      .populate("driverId", "name")
      .populate("contractId");

    if (!resign) {
      return res.status(404).json({
        success: false,
        message: "Resign request nahi mili",
      });
    }

    if (
      String(resign.ownerId) !== String(uid(req))
    ) {
      return res.status(403).json({
        success: false,
        message: "Access nahi hai",
      });
    }

    resign.status = action;
    resign.ownerResponse = response || "";
    await resign.save();

    const respText = response || "";

    if (action === "approved") {
      const contractId = resign.contractId?._id || resign.contractId;
      const jobId = resign.contractId?.jobId;

      await Contract.findByIdAndUpdate(contractId, {
        status: "terminated",
      });

      if (jobId) {
        await Application.findOneAndUpdate(
          {
            jobId,
            driverId: resign.driverId._id,
          },
          { status: "terminated" }
        );

        await Job.findByIdAndUpdate(jobId, {
          status: "open",
          hiredDriver: null,
        });

        const job = await Job.findById(jobId).select("vehicleId").lean();
        if (job?.vehicleId) {
          await Vehicle.findByIdAndUpdate(job.vehicleId, {
            assignedDriver: null,
          });

          const vehicle = await Vehicle.findById(job.vehicleId).lean();
          await Notification.create({
            userId: uid(req),
            title: "Gadi Mein Driver Nahi!",
            message: `${resign.driverId.name} ke resign ke baad aapki ${vehicle?.vehicleType || "gadi"} (${vehicle?.vehicleNumber || ""}) mein koi driver nahi hai. Naya driver hire karein.`,
            type: "new_application",
            link: "/owner/post-job",
            isRead: false,
          });
        }
      }

      await Notification.create({
        userId: resign.driverId._id,
        title: "Resign Approve Ho Gayi!",
        message:
          "Owner ne aapki resign approve kar di. Ab aap naya kaam dhundh sakte hain.",
        type: "complaint_update",
        link: "/driver/active-job",
        isRead: false,
      });
    } else {
      await Notification.create({
        userId: resign.driverId._id,
        title: "Resign Reject Ho Gayi",
        message: `Owner ne resign reject ki. ${respText}`,
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
    return res.status(500).json({
      success: false,
      message: error.message,
    });
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
      .sort({ createdAt: -1 });

    return res.json({ success: true, resigns });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  requestResign,
  handleResign,
  getResignRequests,
};
