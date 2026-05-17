const express = require("express");
const router = express.Router();
const {
  driverAddRecord,
  driverGetRecords,
  driverDeleteRecord,
  ownerAddRecord,
  ownerGetRecords,
  ownerDeleteRecord,
  ownerGetAllContracts,
} = require("../controllers/attendanceController");
const { verifyToken, isOwner, isDriver } = require("../middleware/authMiddleware");
const { requireActiveSubscription } =
  require("../middleware/subscriptionMiddleware");

router.post(
  "/driver/add",
  verifyToken,
  isDriver,
  requireActiveSubscription,
  driverAddRecord
);
router.get("/driver/records", verifyToken, isDriver, driverGetRecords);
router.delete("/driver/:id", verifyToken, isDriver, driverDeleteRecord);

router.post(
  "/owner/add",
  verifyToken,
  isOwner,
  requireActiveSubscription,
  ownerAddRecord
);
router.get("/owner/records", verifyToken, isOwner, ownerGetRecords);
router.delete("/owner/:id", verifyToken, isOwner, ownerDeleteRecord);
router.get("/owner/contracts", verifyToken, isOwner, ownerGetAllContracts);

module.exports = router;
