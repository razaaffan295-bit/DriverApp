const mongoose = require("mongoose");
const Notification = require("../models/Notification");

// Constants
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const uidFromReq = (req) => req.user._id || req.user.id;

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

const getNotifications = async (req, res) => {
  try {
    const uid = uidFromReq(req);

    // Dynamic limit with cap
    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

    // PARALLEL - notifications + unread count (2x faster)
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId: uid })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Notification.countDocuments({
        userId: uid,
        isRead: false,
      }),
    ]);

    return res.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const markAllRead = async (req, res) => {
  try {
    const uid = uidFromReq(req);
    await Notification.updateMany(
      {
        userId: uid,
        isRead: false,
      },
      {
        $set: { isRead: true },
      }
    );
    return res.json({
      success: true,
      message: "Sab notifications read mark ho gayi",
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const markOneRead = async (req, res) => {
  try {
    const uid = uidFromReq(req);
    const notificationId = req.params.id;

    // ObjectId validation
    if (!isValidObjectId(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    const updated = await Notification.findOneAndUpdate(
      { _id: notificationId, userId: uid },
      { $set: { isRead: true } },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.json({ success: true });
  } catch (error) {
    return sendServerError(res);
  }
};

module.exports = {
  getNotifications,
  markAllRead,
  markOneRead,
};
