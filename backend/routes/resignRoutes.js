const express = require("express");
const router = express.Router();
const {
  requestResign,
  handleResign,
  getResignRequests,
} = require("../controllers/resignController");
const {
  verifyToken,
  isDriver,
  isOwner,
} = require("../middleware/authMiddleware");
const { requireActiveSubscription } =
  require("../middleware/subscriptionMiddleware");

router.get("/", verifyToken, getResignRequests);
router.post(
  "/request",
  verifyToken,
  isDriver,
  requireActiveSubscription,
  requestResign
);
router.put("/handle", verifyToken, isOwner, handleResign);

module.exports = router;
