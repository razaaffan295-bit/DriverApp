const express = require("express");
const router = express.Router();
const {
  getNotifications,
  markAllRead,
  markOneRead,
} = require("../controllers/notificationController");
const { verifyToken } = require("../middleware/authMiddleware");
const { validateObjectId } =
  require("../middleware/validateParams");

router.use(verifyToken);
router.get("/", getNotifications);
router.put("/read", markAllRead);
router.put("/mark-all-read", markAllRead);
router.put("/:id/read", validateObjectId("id"), markOneRead);

router.delete('/:id', validateObjectId('id'), async (req, res) => {
  try {
    const Notification = require(
      '../models/Notification'
    )
    await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id || req.user.id,
    })
    res.json({ success: true })
  } catch (error) {
    console.error('[Error]', error)
    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production'
        ? 'Server error'
        : error.message,
    })
  }
})

module.exports = router;
