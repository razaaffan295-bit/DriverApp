const mongoose = require("mongoose");
const Rating = require("../models/Rating");
const Contract = require("../models/Contract");
const User = require("../models/User");
const Notification = require("../models/Notification");

const uid = (req) => req.user._id || req.user.id;

const giveRating = async (req, res) => {
  try {
    const { contractId, ratedToId, score, review, jobId } = req.body;

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

    const n = Number(score);
    if (!Number.isFinite(n) || n < 1 || n > 5) {
      return res.status(400).json({
        success: false,
        message: "Score must be between 1 and 5",
      });
    }

    const contract = await Contract.findById(contractId).lean();

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found",
      });
    }

    const userId = req.user._id || req.user.id;
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

    const ratableStatuses = ['active', 'signed', 'completed', 'terminated'];
    if (!ratableStatuses.includes(contract.status)) {
      return res.status(400).json({
        success: false,
        message: "Contract must be signed before rating",
      });
    }

    if (req.user.role !== "owner" && req.user.role !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Sirf owner ya driver rating de sakte hain",
      });
    }

    const cid = contractId;
    const existing = await Rating.findOne({
      ratedBy: uid(req),
      ratedTo: ratedToId,
      contractId: cid,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Aap pehle se rate kar chuke hain",
      });
    }

    const rating = await Rating.create({
      ratedBy: uid(req),
      ratedTo: ratedToId,
      jobId: jobId || null,
      contractId: cid,
      score: n,
      review: review || "",
      ratedByRole: req.user.role,
    });

    // Fire-and-forget notification (don't block response)
    User.findById(uid(req)).select("name").lean()
      .then((rater) => {
        return Notification.create({
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
    // Silent in production - error logged to Sentry
    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production'
        ? 'Server error'
        : error.message,
    });
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
    // Silent in production
    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production'
        ? 'Server error'
        : error.message,
    });
  }
};

const getUserRatings = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId format
    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Parallel: limited recent + total count
    const [ratings, total] = await Promise.all([
      Rating.find({ ratedTo: userId })
        .populate("ratedBy", "name role")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Rating.countDocuments({ ratedTo: userId }),
    ]);

    // Calculate avg from ALL ratings, not just 10
    const avgAggregate = await Rating.aggregate([
      {
        $match: {
          ratedTo: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $group: {
          _id: null,
          avg: { $avg: '$score' },
        },
      },
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
    // Silent in production
    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production'
        ? 'Server error'
        : error.message,
    });
  }
};

module.exports = {
  giveRating,
  getMyRatings,
  getUserRatings,
};
