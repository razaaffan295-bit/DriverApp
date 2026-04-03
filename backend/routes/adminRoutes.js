const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  getUsers,
  blockUser,
  unblockUser,
  getAllComplaints,
  resolveComplaint,
  getSubscriptions,
  verifyUser,
} = require("../controllers/adminController");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");

router.use(verifyToken, isAdmin);

router.get("/stats", getDashboardStats);
router.get("/users", getUsers);
router.put("/users/block", blockUser);
router.put("/users/unblock", unblockUser);
router.get("/complaints", getAllComplaints);
router.put("/complaints/resolve", resolveComplaint);
router.get("/subscriptions", getSubscriptions);
router.put("/users/verify", verifyUser);

module.exports = router;
