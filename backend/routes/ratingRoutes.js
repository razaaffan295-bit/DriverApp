const express = require("express");
const router = express.Router();
const {
  giveRating,
  getMyRatings,
  getUserRatings,
} = require("../controllers/ratingController");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireActiveSubscription } =
  require("../middleware/subscriptionMiddleware");

router.use(verifyToken);
router.post("/", requireActiveSubscription, giveRating);
router.get("/my", getMyRatings);
router.get("/user/:userId", getUserRatings);

module.exports = router;
