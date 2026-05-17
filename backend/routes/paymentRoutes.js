const express = require("express");
const router = express.Router();
const { upload } = require("../config/cloudinary");
const {
  getPaymentSummary,
  makePayment,
  confirmPayment,
  rejectPayment,
  getPayments,
  requestPayment,
  createTripPaymentRequest,
  requestAdvance,
  handleAdvance,
  getAdvances,
  getOwnerPaymentsSummary,
} = require("../controllers/paymentController");
const {
  verifyToken,
  isOwner,
  isDriver,
} = require("../middleware/authMiddleware");
const { cacheMiddleware } = require("../middleware/cacheMiddleware");
const { requireActiveSubscription } =
  require("../middleware/subscriptionMiddleware");

router.get("/summary", verifyToken, getPaymentSummary);
router.post(
  "/make",
  verifyToken,
  isOwner,
  requireActiveSubscription,
  upload.single("proofPhoto"),
  makePayment
);
router.put("/confirm", verifyToken, isDriver, confirmPayment);
router.put("/reject", verifyToken, isDriver, rejectPayment);
router.get(
  "/owner-summary",
  verifyToken,
  isOwner,
  cacheMiddleware(60),
  getOwnerPaymentsSummary
);
router.get("/history", verifyToken, getPayments);
router.post(
  "/request",
  verifyToken,
  isDriver,
  requireActiveSubscription,
  requestPayment
);
router.post(
  "/trip-request",
  verifyToken,
  isDriver,
  requireActiveSubscription,
  createTripPaymentRequest
);
router.post(
  "/advance/request",
  verifyToken,
  isDriver,
  requireActiveSubscription,
  requestAdvance
);
router.put("/advance/handle", verifyToken, isOwner, handleAdvance);
router.get("/advances", verifyToken, getAdvances);

module.exports = router;
