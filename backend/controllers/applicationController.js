const mongoose = require("mongoose");
const Application = require("../models/Application");
const Job = require("../models/Job");
const DriverProfile = require("../models/DriverProfile");
const Contract = require("../models/Contract");
const Notification = require("../models/Notification");
const User = require("../models/User");
const Rating = require("../models/Rating");

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

// Fire-and-forget notification (non-blocking)
const createNotificationSafe = (data) => {
  Notification.create(data).catch(() => {
    // Silent fail - notification failure shouldn't break the action
  });
};

const getJobApplications = async (req, res) => {
  try {
    const { jobId } = req.params;
    const oid = ownerIdFromReq(req);

    // Validate ObjectId
    if (!isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID",
      });
    }

    // Step 1: Check job ownership (need this first for auth)
    const job = await Job.findById(jobId).select("ownerId").lean();
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

    // Step 2: Get applications
    const apps = await Application.find({ jobId })
      .populate("driverId", "name phone location")
      .lean();

    // Step 3: Get profiles in parallel (if needed)
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

    // O(1) lookup map
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
    return sendServerError(res);
  }
};

const getOwnerApplications = async (req, res) => {
  try {
    const oid = ownerIdFromReq(req);

    // Step 1: Get apps (need first for IDs)
    const apps = await Application.find({ ownerId: oid })
      .populate({
        path: "driverId",
        select: "_id name phone location isVerified profilePhoto",
      })
      .populate({
        path: "jobId",
        select: "_id title vehicleType location salaryPerDay duration salaryPerMonth vehicleCategory salaryType",
      })
      .sort({ appliedAt: -1 })
      .lean();

    // Extract IDs for parallel queries
    const driverIds = apps
      .map((a) => a.driverId && a.driverId._id)
      .filter(Boolean);

    const acceptedOrActive = apps.filter(
      (a) =>
        a.status === "accepted" ||
        a.status === "active" ||
        a.status === "terminated"
    );

    // Step 2: PARALLEL - profiles + contracts + ratings (3x faster)
    const [profiles, contractRows, ratingsData] = await Promise.all([
      // Profiles
      driverIds.length
        ? DriverProfile.find({ driverId: { $in: driverIds } })
            .select("driverId skills experience licenseNumber licenseType about")
            .lean()
        : Promise.resolve([]),

      // Contracts
      acceptedOrActive.length
        ? Contract.find({
            $or: acceptedOrActive.map((a) => ({
              jobId: a.jobId?._id || a.jobId,
              driverId: a.driverId?._id || a.driverId,
            })),
          })
            .select("_id jobId driverId status")
            .lean()
        : Promise.resolve([]),

      // Ratings aggregate
      driverIds.length > 0
        ? Rating.aggregate([
            { $match: { ratedTo: { $in: driverIds } } },
            {
              $group: {
                _id: "$ratedTo",
                avgRating: { $avg: "$score" },
                count: { $sum: 1 },
              },
            },
          ])
        : Promise.resolve([]),
    ]);

    // Build lookup maps - O(1) access
    const profileByDriver = {};
    profiles.forEach((p) => {
      profileByDriver[String(p.driverId)] = p;
    });

    const contractKeys = new Set();
    const contractIdByKey = {};
    const contractStatusByKey = {};
    contractRows.forEach((c) => {
      const key = `${String(c.jobId)}_${String(c.driverId)}`;
      contractKeys.add(key);
      contractIdByKey[key] = c._id;
      contractStatusByKey[key] = c.status || null;
    });

    const ratingsMap = {};
    ratingsData.forEach((r) => {
      ratingsMap[String(r._id)] = {
        avgRating: r.avgRating,
        count: r.count,
      };
    });

    // Build final response
    const applications = apps.map((a) => {
      const did = a.driverId?._id && String(a.driverId._id);
      const jid = a.jobId?._id || a.jobId;
      const dk = jid && did ? `${String(jid)}_${did}` : "";

      let avgRating = 0;
      let totalRatings = 0;
      if (did) {
        const hit = ratingsMap[did];
        if (hit) {
          totalRatings = hit.count;
          avgRating =
            totalRatings > 0
              ? Number(hit.avgRating).toFixed(1)
              : 0;
        }
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
    });

    return res.json({
      success: true,
      applications,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const acceptApplication = async (req, res) => {
  try {
    const oid = ownerIdFromReq(req);
    const applicationId = req.params.id;

    // Validate ObjectId
    if (!isValidObjectId(applicationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID",
      });
    }

    // Atomic update - find + accept in 1 query
    const application = await Application.findOneAndUpdate(
      {
        _id: applicationId,
        ownerId: oid,
        status: "pending",
      },
      { $set: { status: "accepted" } },
      { new: false } // Returns OLD doc to check it existed
    );

    if (!application) {
      // Either not found, not owner, or not pending
      const exists = await Application.findById(applicationId)
        .select("ownerId status")
        .lean();
      if (!exists) {
        return res.status(404).json({
          success: false,
          message: "Application nahi mili",
        });
      }
      if (String(exists.ownerId) !== String(oid)) {
        return res.status(403).json({
          success: false,
          message: "Yeh aapki application nahi hai",
        });
      }
      return res.status(400).json({
        success: false,
        message: "Sirf pending application accept ho sakti hai",
      });
    }

    // Parallel updates - 2x faster
    const [, , owner] = await Promise.all([
      // Mark job as filled
      Job.updateOne(
        { _id: application.jobId },
        {
          hiredDriver: application.driverId,
          status: "filled",
        }
      ),
      // Reject other applications
      Application.updateMany(
        {
          jobId: application.jobId,
          _id: { $ne: application._id },
        },
        { status: "rejected" }
      ),
      // Get owner name for notification
      User.findById(oid).select("name").lean(),
    ]);

    // Non-blocking notification (fire-and-forget)
    createNotificationSafe({
      userId: application.driverId,
      title: "Application Accepted",
      message: `${owner?.name || "Owner"} accepted your application. Please wait for the joining letter.`,
      type: "application_accepted",
      link: "/driver/active-job",
      isRead: false,
    });

    return res.json({ success: true });
  } catch (error) {
    return sendServerError(res);
  }
};

const rejectApplication = async (req, res) => {
  try {
    const oid = ownerIdFromReq(req);
    const applicationId = req.params.id;

    // Validate ObjectId
    if (!isValidObjectId(applicationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID",
      });
    }

    // Atomic update - find + reject in 1 query
    const application = await Application.findOneAndUpdate(
      {
        _id: applicationId,
        ownerId: oid,
        status: "pending",
      },
      { $set: { status: "rejected" } },
      { new: true }
    ).lean();

    if (!application) {
      // Detailed error check
      const exists = await Application.findById(applicationId)
        .select("ownerId status")
        .lean();
      if (!exists) {
        return res.status(404).json({
          success: false,
          message: "Application nahi mili",
        });
      }
      if (String(exists.ownerId) !== String(oid)) {
        return res.status(403).json({
          success: false,
          message: "Yeh aapki application nahi hai",
        });
      }
      return res.status(400).json({
        success: false,
        message: "Sirf pending application reject ho sakti hai",
      });
    }

    return res.json({ success: true });
  } catch (error) {
    return sendServerError(res);
  }
};

const cancelApplication = async (req, res) => {
  try {
    const oid = ownerIdFromReq(req);
    const applicationId = req.params.id;

    // Validate ObjectId
    if (!isValidObjectId(applicationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID",
      });
    }

    // Step 1: Get application
    const application = await Application.findById(applicationId);
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

    // Step 2: Check if contract exists (blocks cancellation)
    const existingContract = await Contract.findOne({
      jobId: application.jobId,
      driverId: application.driverId,
    })
      .select("_id")
      .lean();

    if (existingContract) {
      return res.status(400).json({
        success: false,
        message: "Joining letter bhej diya hai, cancel nahi ho sakta",
      });
    }

    // Step 3: Parallel updates - 2x faster
    application.status = "pending";
    await Promise.all([
      application.save(),
      Job.updateOne(
        { _id: application.jobId },
        {
          hiredDriver: null,
          status: "open",
        }
      ),
    ]);

    return res.json({ success: true });
  } catch (error) {
    return sendServerError(res);
  }
};

module.exports = {
  getJobApplications,
  getOwnerApplications,
  acceptApplication,
  rejectApplication,
  cancelApplication,
};
