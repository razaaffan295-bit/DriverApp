const Notification = require("../models/Notification");

const uidFromReq = (req) => req.user._id || req.user.id;

const getNotifications = async (req, res) => {
  try {
    const uid = uidFromReq(req);
    const notifications = await Notification.find({
      userId: uid,
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const unreadCount = await Notification.countDocuments({
      userId: uid,
      isRead: false,
    });

    return res.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
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
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const markOneRead = async (req, res) => {
  try {
    const uid = uidFromReq(req);
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: uid },
      { isRead: true }
    );
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getNotifications,
  markAllRead,
  markOneRead,
};
