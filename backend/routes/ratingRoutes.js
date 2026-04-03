const express = require("express");
const router = express.Router();
const {
  giveRating,
  getMyRatings,
  getUserRatings,
} = require("../controllers/ratingController");
const { verifyToken } = require("../middleware/authMiddleware");

router.use(verifyToken);
router.post("/", giveRating);
router.get("/my", getMyRatings);
router.get("/user/:userId", getUserRatings);

module.exports = router;
