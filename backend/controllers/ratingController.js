const mongoose = require("mongoose");
const Rating = require("../models/Rating");
const Contract = require("../models/Contract");
const User = require("../models/User");
const Notification = require("../models/Notification");

// Constants
const MAX_REVIEW_LENGTH = 2000;
const MIN_SCORE = 1;
const MAX_SCORE = 5;
const RECENT_RATINGS_LIMIT = 10;
const RATABLE_STATUSES = ["active", "signed", "completed", "terminated"];

const uid = (req) => req.user._id || req.user.id;

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

const giveRating = async (req, res) => {
  try {
    const { contractId, ratedToId, score, review, jobId } = req.body;
    const userId = uid(req);

    if (!contractId) {
      return res.status(400).json({
        success: false,
        message: "contractId is required",
      });
    }

    if (!ratedToId) {
      return res.status(400).json({
        success: false,
        message: "ratedToId is required",
      });
    }

    // ObjectId validations
    if (!isValidObjectId(contractId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contract ID",
      });
    }
    if (!isValidObjectId(ratedToId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ratedTo ID",
      });
    }
    if (jobId && !isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID",
      });
    }

    const n = Number(score);
    if (!Number.isFinite(n) || n < MIN_SCORE || n > MAX_SCORE) {
      return res.status(400).json({
        success: false,
        message: `Score must be between ${MIN_SCORE} and ${MAX_SCORE}`,
      });
    }

    // Role check (cheapest - no DB)
    if (req.user.role !== "owner" && req.user.role !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Sirf owner ya driver rating de sakte hain",
      });
    }

    const reviewTrim = String(review || "").slice(0, MAX_REVIEW_LENGTH);

    // PARALLEL - contract + existing rating check (2x faster)
    const [contract, existing] = await Promise.all([
      Contract.findById(contractId).lean(),
      Rating.findOne({
        ratedBy: userId,
        ratedTo: ratedToId,
        contractId,
      })
        .select("_id")
        .lean(),
    ]);

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found",
      });
    }

    const userIdStr = String(userId);
    const ownerIdStr = String(contract.ownerId);
    const driverIdStr = String(contract.driverId);
    const ratedToStr = String(ratedToId);

    const isOwnerRating =
      userIdStr === ownerIdStr && ratedToStr === driverIdStr;
    const isDriverRating =
      userIdStr === driverIdStr && ratedToStr === ownerIdStr;

    if (!isOwnerRating && !isDriverRating) {
      return res.status(403).json({
        success: false,
        message: "You can only rate parties of your contract",
      });
    }

    if (!RATABLE_STATUSES.includes(contract.status)) {
      return res.status(400).json({
        success: false,
        message: "Contract must be signed before rating",
      });
    }

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Aap pehle se rate kar chuke hain",
      });
    }

    const rating = await Rating.create({
      ratedBy: userId,
      ratedTo: ratedToId,
      jobId: jobId || null,
      contractId,
      score: n,
      review: reviewTrim,
      ratedByRole: req.user.role,
    });

    // Fire-and-forget notification (don't block response)
    User.findById(userId)
      .select("name")
      .lean()
      .then((rater) => {
        createNotificationSafe({
          userId: ratedToId,
          title: "New Rating",
          message: `${rater?.name || "User"} gave you ${n} stars.`,
          type: "complaint_update",
          link:
            req.user.role === "owner"
              ? "/driver/ratings"
              : "/owner/ratings",
          isRead: false,
        });
      })
      .catch(() => {
        // Notification failure shouldn't break rating
      });

    return res.json({
      success: true,
      rating,
      message: "Rating de di gayi!",
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getMyRatings = async (req, res) => {
  try {
    const id = uid(req);

    // Parallel queries - 2x faster
    const [received, given] = await Promise.all([
      Rating.find({ ratedTo: id })
        .populate("ratedBy", "name role")
        .populate("jobId", "title vehicleType")
        .sort({ createdAt: -1 })
        .lean(),
      Rating.find({ ratedBy: id })
        .populate("ratedTo", "name role")
        .populate("jobId", "title vehicleType")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const validReceived = received.filter(
      (r) => Number.isFinite(Number(r.score))
    );

    const avgScore =
      validReceived.length > 0
        ? (
            validReceived.reduce(
              (sum, r) => sum + Number(r.score),
              0
            ) / validReceived.length
          ).toFixed(1)
        : "0";

    return res.json({
      success: true,
      received,
      given,
      avgScore,
      totalRatings: received.length,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getUserRatings = async (req, res) => {
  try {
    const { userId } = req.params;

    // ObjectId validation
    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // PARALLEL - 3 queries at once (3x faster)
    const [ratings, total, avgAggregate] = await Promise.all([
      Rating.find({ ratedTo: userId })
        .populate("ratedBy", "name role")
        .sort({ createdAt: -1 })
        .limit(RECENT_RATINGS_LIMIT)
        .lean(),
      Rating.countDocuments({ ratedTo: userId }),
      Rating.aggregate([
        { $match: { ratedTo: userObjectId } },
        {
          $group: {
            _id: null,
            avg: { $avg: "$score" },
          },
        },
      ]),
    ]);

    const avgScore = avgAggregate.length > 0
      ? Number(avgAggregate[0].avg || 0).toFixed(1)
      : "0";

    return res.json({
      success: true,
      ratings,
      avgScore,
      total,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

module.exports = {
  giveRating,
  getMyRatings,
  getUserRatings,
};
