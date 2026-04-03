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

module.exports = router;
