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

router.post("/driver/add", verifyToken, isDriver, driverAddRecord);
router.get("/driver/records", verifyToken, isDriver, driverGetRecords);
router.delete("/driver/:id", verifyToken, isDriver, driverDeleteRecord);

router.post("/owner/add", verifyToken, isOwner, ownerAddRecord);
router.get("/owner/records", verifyToken, isOwner, ownerGetRecords);
router.delete("/owner/:id", verifyToken, isOwner, ownerDeleteRecord);
router.get("/owner/contracts", verifyToken, isOwner, ownerGetAllContracts);

module.exports = router;
