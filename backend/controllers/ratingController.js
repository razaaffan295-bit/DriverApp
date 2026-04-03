const Rating = require("../models/Rating");
const Contract = require("../models/Contract");
const User = require("../models/User");
const Notification = require("../models/Notification");

const uid = (req) => req.user._id || req.user.id;

const giveRating = async (req, res) => {
  try {
    const { ratedToId, jobId, contractId, score, review } = req.body;

    if (!ratedToId || score === undefined || score === null) {
      return res.status(400).json({
        success: false,
        message: "User aur score required",
      });
    }

    const n = Number(score);
    if (!Number.isFinite(n) || n < 1 || n > 5) {
      return res.status(400).json({
        success: false,
        message: "Score 1 se 5 ke beech hona chahiye",
      });
    }

    if (req.user.role !== "owner" && req.user.role !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Sirf owner ya driver rating de sakte hain",
      });
    }

    const cid = contractId || null;
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

    if (contractId) {
      const contract = await Contract.findById(contractId);
      if (!contract) {
        return res.status(404).json({
          success: false,
          message: "Contract nahi mila",
        });
      }

      const allowed = [
        "active",
        "completed",
        "terminated",
      ].includes(contract.status);
      if (!allowed) {
        return res.status(400).json({
          success: false,
          message:
            "Sirf active, complete ya terminate contract pe hi rating de sakte hain",
        });
      }

      const me = String(uid(req));
      const isOwner =
        String(contract.ownerId) === me;
      const isDriver =
        String(contract.driverId) === me;
      if (!isOwner && !isDriver) {
        return res.status(403).json({
          success: false,
          message: "Is contract mein aap nahi hain",
        });
      }
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

    const rater = await User.findById(uid(req)).select("name");

    await Notification.create({
      userId: ratedToId,
      title: "Nayi Rating Mili!",
      message: `${rater?.name || "User"} ne aapko ${n} star diya.`,
      type: "complaint_update",
      link:
        req.user.role === "owner"
          ? "/driver/ratings"
          : "/owner/ratings",
      isRead: false,
    });

    return res.json({
      success: true,
      rating,
      message: "Rating de di gayi!",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getMyRatings = async (req, res) => {
  try {
    const id = uid(req);

    const received = await Rating.find({ ratedTo: id })
      .populate("ratedBy", "name role")
      .populate("jobId", "title vehicleType")
      .sort({ createdAt: -1 });

    const given = await Rating.find({ ratedBy: id })
      .populate("ratedTo", "name role")
      .populate("jobId", "title vehicleType")
      .sort({ createdAt: -1 });

    const avgScore =
      received.length > 0
        ? (
            received.reduce(
              (sum, r) => sum + (Number(r.score) || 0),
              0
            ) / received.length
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
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getUserRatings = async (req, res) => {
  try {
    const ratings = await Rating.find({
      ratedTo: req.params.userId,
    })
      .populate("ratedBy", "name role")
      .sort({ createdAt: -1 })
      .limit(10);

    const avgScore =
      ratings.length > 0
        ? (
            ratings.reduce(
              (sum, r) => sum + (Number(r.score) || 0),
              0
            ) / ratings.length
          ).toFixed(1)
        : "0";

    return res.json({
      success: true,
      ratings,
      avgScore,
      total: ratings.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  giveRating,
  getMyRatings,
  getUserRatings,
};
