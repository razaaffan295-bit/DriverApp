const express = require("express");
const router = express.Router();
const {
  createOrder,
  verifyPayment,
  checkSubscription,
} = require("../controllers/subscriptionController");
const { verifyToken } = require("../middleware/authMiddleware");

router.post("/create-order", verifyToken, createOrder);
router.post("/verify", verifyToken, verifyPayment);
router.get("/check", verifyToken, checkSubscription);

module.exports = router;
