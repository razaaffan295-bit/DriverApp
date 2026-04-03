const express = require("express");
const router = express.Router();
const {
  createComplaint,
  getMyComplaints,
  getComplaintById,
} = require("../controllers/complaintController");
const { verifyToken } = require("../middleware/authMiddleware");

router.use(verifyToken);
router.post("/", createComplaint);
router.get("/my", getMyComplaints);
router.get("/:id", getComplaintById);

module.exports = router;
