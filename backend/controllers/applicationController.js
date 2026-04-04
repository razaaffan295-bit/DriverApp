const Application = require("../models/Application");
const Job = require("../models/Job");
const DriverProfile = require("../models/DriverProfile");
const Contract = require("../models/Contract");
const Notification = require("../models/Notification");
const User = require("../models/User");
const Rating = require("../models/Rating");

const ownerIdFromReq = (req) => req.user._id || req.user.id;

const getJobApplications = async (req, res) => {
  try {
    const { jobId } = req.params;
    const oid = ownerIdFromReq(req);
    const job = await Job.findById(jobId);
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

    const apps = await Application.find({ jobId })
      .populate("driverId", "name phone location")
      .lean();

    const driverIds = apps
      .map((a) => a.driverId && a.driverId._id)
      .filter(Boolean);
    const profiles = driverIds.length
      ? await DriverProfile.find({
          driverId: { $in: driverIds },
        })
          .select(
            "driverId skills experience licenseNumber licenseType about"
          )
          .lean()
      : [];
    const profileByDriver = {};
    profiles.forEach((p) => {
      profileByDriver[String(p.driverId)] = p;
    });

    const applications = apps.map((a) => {
      const did = a.driverId?._id && String(a.driverId._id);
      return {
        ...a,
        driverProfile: did ? profileByDriver[did] || null : null,
      };
    });

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

const getOwnerApplications = async (req, res) => {
  try {
    const oid = ownerIdFromReq(req);
    const apps = await Application.find({ ownerId: oid })
      .populate({
        path: "driverId",
        select:
          "_id name phone location isVerified profilePhoto",
      })
      .populate({
        path: "jobId",
        select:
          "_id title vehicleType location salaryPerDay duration salaryPerMonth vehicleCategory salaryType",
      })
      .sort({ appliedAt: -1 })
      .lean();

    const driverIds = apps
      .map((a) => a.driverId && a.driverId._id)
      .filter(Boolean);
    const profiles = driverIds.length
      ? await DriverProfile.find({
          driverId: { $in: driverIds },
        })
          .select(
            "driverId skills experience licenseNumber licenseType about"
          )
          .lean()
      : [];
    const profileByDriver = {};
    profiles.forEach((p) => {
      profileByDriver[String(p.driverId)] = p;
    });

    const accepted = apps.filter((a) => a.status === "accepted");
    const acceptedOrActive = apps.filter(
      (a) =>
        a.status === "accepted" ||
        a.status === "active" ||
        a.status === "terminated"
    );
    let contractKeys = new Set();
    const contractIdByKey = {};
    const contractStatusByKey = {};
    if (acceptedOrActive.length) {
      const or = acceptedOrActive.map((a) => ({
        jobId: a.jobId?._id || a.jobId,
        driverId: a.driverId?._id || a.driverId,
      }));
      const contractRows = await Contract.find({ $or: or })
        .select("_id jobId driverId status")
        .lean();
      contractKeys = new Set(
        contractRows.map(
          (c) => `${String(c.jobId)}_${String(c.driverId)}`
        )
      );
      contractRows.forEach((c) => {
        const key = `${String(c.jobId)}_${String(c.driverId)}`;
        contractIdByKey[key] = c._id;
        contractStatusByKey[key] = c.status || null;
      });
    }

    const applications = await Promise.all(
      apps.map(async (a) => {
        const did = a.driverId?._id && String(a.driverId._id);
        const jid = a.jobId?._id || a.jobId;
        const dk = jid && did ? `${String(jid)}_${did}` : "";

        let avgRating = 0;
        let totalRatings = 0;
        if (did) {
          const ratings = await Rating.find({
            ratedTo: did,
          })
            .select("score")
            .lean();
          totalRatings = ratings.length;
          avgRating =
            totalRatings > 0
              ? (
                  ratings.reduce(
                    (s, r) => s + (Number(r.score) || 0),
                    0
                  ) / totalRatings
                ).toFixed(1)
              : 0;
        }

        const driverIdEnriched = a.driverId
          ? {
              ...a.driverId,
              avgRating,
              totalRatings,
            }
          : a.driverId;

        return {
          ...a,
          driverId: driverIdEnriched,
          driverProfile: did ? profileByDriver[did] || null : null,
          canCancelAccept:
            a.status === "accepted" &&
            dk &&
            !contractKeys.has(dk),
          contractId: dk ? contractIdByKey[dk] || null : null,
          contractStatus: dk ? contractStatusByKey[dk] || null : null,
        };
      })
    );

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

const acceptApplication = async (req, res) => {
  try {
    const oid = ownerIdFromReq(req);
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application nahi mili",
      });
    }
    if (String(application.ownerId) !== String(oid)) {
      return res.status(403).json({
        success: false,
        message: "Yeh aapki application nahi hai",
      });
    }
    if (application.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Sirf pending application accept ho sakti hai",
      });
    }

    application.status = "accepted";
    await application.save();

    await Job.updateOne(
      { _id: application.jobId },
      {
        hiredDriver: application.driverId,
        status: "filled",
      }
    );

    await Application.updateMany(
      {
        jobId: application.jobId,
        _id: { $ne: application._id },
      },
      { status: "rejected" }
    );

    const owner = await User.findById(oid).select("name");
    await Notification.create({
      userId: application.driverId,
      title: "Application Accept Ho Gayi!",
      message: `${owner?.name || "Owner"} ne aapki application accept kar li. Joining letter ka wait karein.`,
      type: "application_accepted",
      link: "/driver/active-job",
      isRead: false,
    });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const rejectApplication = async (req, res) => {
  try {
    const oid = ownerIdFromReq(req);
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application nahi mili",
      });
    }
    if (String(application.ownerId) !== String(oid)) {
      return res.status(403).json({
        success: false,
        message: "Yeh aapki application nahi hai",
      });
    }
    if (application.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Sirf pending application reject ho sakti hai",
      });
    }
    application.status = "rejected";
    await application.save();
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const cancelApplication = async (req, res) => {
  try {
    const oid = ownerIdFromReq(req);
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application nahi mili",
      });
    }
    if (String(application.ownerId) !== String(oid)) {
      return res.status(403).json({
        success: false,
        message: "Yeh aapki application nahi hai",
      });
    }
    if (application.status !== "accepted") {
      return res.status(400).json({
        success: false,
        message: "Sirf accepted application cancel ho sakti hai",
      });
    }
    const existingContract = await Contract.findOne({
      jobId: application.jobId,
      driverId: application.driverId,
    });
    if (existingContract) {
      return res.status(400).json({
        success: false,
        message:
          "Joining letter bhej diya hai, cancel nahi ho sakta",
      });
    }

    application.status = "pending";
    await application.save();

    await Job.updateOne(
      { _id: application.jobId },
      {
        hiredDriver: null,
        status: "open",
      }
    );

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

module.exports = {
  getJobApplications,
  getOwnerApplications,
  acceptApplication,
  rejectApplication,
  cancelApplication,
};
