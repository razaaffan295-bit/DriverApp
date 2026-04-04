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
} = require("../controllers/paymentController");
const {
  verifyToken,
  isOwner,
  isDriver,
} = require("../middleware/authMiddleware");

router.get("/summary", verifyToken, getPaymentSummary);
router.post(
  "/make",
  verifyToken,
  isOwner,
  upload.single("proofPhoto"),
  makePayment
);
router.put("/confirm", verifyToken, isDriver, confirmPayment);
router.put("/reject", verifyToken, isDriver, rejectPayment);
router.get("/history", verifyToken, getPayments);
router.post("/request", verifyToken, isDriver, requestPayment);
router.post(
  "/trip-request",
  verifyToken,
  isDriver,
  createTripPaymentRequest
);
router.post("/advance/request", verifyToken, isDriver, requestAdvance);
router.put("/advance/handle", verifyToken, isOwner, handleAdvance);
router.get("/advances", verifyToken, getAdvances);

module.exports = router;
