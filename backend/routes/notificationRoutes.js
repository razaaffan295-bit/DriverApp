const express = require("express");
const router = express.Router();
const {
  getNotifications,
  markAllRead,
  markOneRead,
} = require("../controllers/notificationController");
const { verifyToken } = require("../middleware/authMiddleware");

router.use(verifyToken);
router.get("/", getNotifications);
router.put("/read", markAllRead);
router.put("/mark-all-read", markAllRead);
router.put("/:id/read", markOneRead);

router.delete('/:id', async (req, res) => {
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
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

module.exports = router;
