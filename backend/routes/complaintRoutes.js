const express = require("express");
const router = express.Router();
const { upload } = require("../config/cloudinary");
const {
  createComplaint,
  getMyComplaints,
  getComplaintById,
} = require("../controllers/complaintController");
const { verifyToken } = require("../middleware/authMiddleware");

router.use(verifyToken);
router.post(
  "/",
  upload.array("evidence", 5),
  createComplaint
);
router.get("/my", getMyComplaints);
router.get("/:id", getComplaintById);

module.exports = router;
