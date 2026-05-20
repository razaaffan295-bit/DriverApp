const mongoose = require("mongoose");
const User = require("../models/User");
const { escapeRegex } = require("../utils/validators");
const Job = require("../models/Job");
const Contract = require("../models/Contract");
const Complaint = require("../models/Complaint");
const Subscription = require("../models/Subscription");
const Vehicle = require("../models/Vehicle");
const DriverProfile = require("../models/DriverProfile");
const Notification = require("../models/Notification");

// Constants
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_REASON_LENGTH = 1000;
const MAX_NOTE_LENGTH = 2000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_30 = 30;
const DAYS_90 = 90;
const MAX_BLOCK_DAYS = 3650;

const ALLOWED_ACTIONS = [
  "no_action",
  "warning",
  "blocked_30days",
  "blocked_90days",
  "permanent_ban",
];

// Helpers
const sendServerError = (res) => {
  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Server error'
      : undefined,
  });
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
};

const createNotificationSafe = (data) => {
  Notification.create(data).catch(() => {
    // Silent fail - non-blocking
  });
};

const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // PARALLEL - all 9 queries at once = 9x faster!
    const [
      totalOwners,
      totalDrivers,
      totalJobs,
      activeJobs,
      activeContracts,
      pendingComplaints,
      monthlySubscriptions,
      totalRevenue,
      ownerRevenue,
      driverRevenue,
    ] = await Promise.all([
      User.countDocuments({ role: "owner" }),
      User.countDocuments({ role: "driver" }),
      Job.countDocuments(),
      Job.countDocuments({ status: "open" }),
      Contract.countDocuments({ status: "active" }),
      Complaint.countDocuments({ status: "pending" }),
      Subscription.find({
        createdAt: { $gte: monthStart },
        status: "active",
      })
        .select("amount")
        .lean(),
      Subscription.aggregate([
        { $match: { status: "active" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Subscription.aggregate([
        { $match: { role: "owner", status: "active" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Subscription.aggregate([
        { $match: { role: "driver", status: "active" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const monthlyRevenue = monthlySubscriptions.reduce(
      (sum, s) => sum + (Number(s.amount) || 0),
      0
    );

    return res.json({
      success: true,
      stats: {
        totalOwners,
        totalDrivers,
        totalJobs,
        activeJobs,
        activeContracts,
        pendingComplaints,
        monthlyRevenue,
        totalRevenue: totalRevenue[0]?.total || 0,
        ownerRevenue: ownerRevenue[0]?.total || 0,
        driverRevenue: driverRevenue[0]?.total || 0,
      },
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getUsers = async (req, res) => {
  try {
    const {
      role,
      state,
      vehicleType,
      search,
      page = 1,
      limit = DEFAULT_LIMIT,
    } = req.query;

    const query = {};
    if (role) query.role = role;
    if (state) query["location.state"] = state;

    // Vehicle type filter for owners
    if (vehicleType && role === "owner") {
      const ownerIds = await Vehicle.distinct("ownerId", {
        vehicleType: String(vehicleType),
      });
      if (!ownerIds.length) {
        return res.json({
          success: true,
          users: [],
          total: 0,
          page: Number(page),
          totalPages: 0,
        });
      }
      query._id = { $in: ownerIds };
    }

    // Vehicle type filter for drivers (via skills)
    if (vehicleType && role === "driver") {
      const profiles = await DriverProfile.find({
        skills: String(vehicleType),
      })
        .select("driverId")
        .lean();
      const ids = profiles.map((p) => p.driverId).filter(Boolean);
      if (!ids.length) {
        return res.json({
          success: true,
          users: [],
          total: 0,
          page: Number(page),
          totalPages: 0,
        });
      }
      query._id = { $in: ids };
    }

    // Search filter
    if (search) {
      const term = String(search).trim();
      query.$or = [
        { name: { $regex: escapeRegex(term), $options: "i" } },
        { phone: { $regex: escapeRegex(term), $options: "i" } },
      ];
    }

    const lim = Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT);
    const pg = Math.max(Number(page) || 1, 1);

    // Parallel - users + total
    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password")
        .sort({ createdAt: -1 })
        .limit(lim)
        .skip((pg - 1) * lim)
        .lean(),
      User.countDocuments(query),
    ]);

    // FIX N+1: Bulk fetch vehicles + profiles by IDs (1 query each, not N)
    const ownerIds = users
      .filter((u) => u.role === "owner")
      .map((u) => u._id);
    const driverIds = users
      .filter((u) => u.role === "driver")
      .map((u) => u._id);

    const [vehicles, profiles] = await Promise.all([
      ownerIds.length
        ? Vehicle.find({ ownerId: { $in: ownerIds } })
            .select("ownerId vehicleType vehicleNumber")
            .lean()
        : Promise.resolve([]),
      driverIds.length
        ? DriverProfile.find({ driverId: { $in: driverIds } })
            .select("driverId skills experience")
            .lean()
        : Promise.resolve([]),
    ]);

    // Build O(1) lookup maps
    const vehiclesByOwner = {};
    vehicles.forEach((v) => {
      const oid = String(v.ownerId);
      if (!vehiclesByOwner[oid]) vehiclesByOwner[oid] = [];
      vehiclesByOwner[oid].push(v);
    });

    const profileByDriver = {};
    profiles.forEach((p) => {
      profileByDriver[String(p.driverId)] = p;
    });

    // Merge details (O(n), no more N+1!)
    const usersWithDetails = users.map((user) => {
      if (user.role === "owner") {
        return {
          ...user,
          vehicles: vehiclesByOwner[String(user._id)] || [],
        };
      }
      if (user.role === "driver") {
        return {
          ...user,
          driverProfile: profileByDriver[String(user._id)] || null,
        };
      }
      return user;
    });

    return res.json({
      success: true,
      users: usersWithDetails,
      total,
      page: pg,
      totalPages: Math.ceil(total / lim) || 0,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const blockUser = async (req, res) => {
  try {
    const { userId, reason, blockDays } = req.body;

    // ObjectId validation
    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const reasonTrim = String(reason || "Admin action").slice(0, MAX_REASON_LENGTH);

    // Validate blockDays range
    const days = Number(blockDays) || 0;
    if (days < 0 || days > MAX_BLOCK_DAYS) {
      return res.status(400).json({
        success: false,
        message: "Block days invalid hai",
      });
    }

    const updates = {
      isBlocked: true,
      blockReason: reasonTrim,
      blockedAt: new Date(),
      blockUntil: days > 0 ? new Date(Date.now() + days * MS_PER_DAY) : null,
    };

    // Atomic update + return updated doc (for notification link)
    const user = await User.findByIdAndUpdate(userId, updates, { new: true })
      .select("_id role")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila",
      });
    }

    // Non-blocking notification
    createNotificationSafe({
      userId: user._id,
      title: "Account Blocked",
      message: reasonTrim || "Your account has been blocked.",
      type: "complaint_update",
      link: user.role === "owner" ? "/owner/complaints" : "/driver/complaints",
      isRead: false,
    });

    return res.json({
      success: true,
      message: "User block ho gaya",
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const unblockUser = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Atomic update + get role in 1 query
    const user = await User.findByIdAndUpdate(
      userId,
      {
        isBlocked: false,
        blockReason: "",
        blockUntil: null,
      },
      { new: true }
    )
      .select("role")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila",
      });
    }

    // Non-blocking notification
    createNotificationSafe({
      userId,
      title: "Account Unblocked",
      message: "Your account has been unblocked.",
      type: "complaint_update",
      link: user.role === "owner" ? "/owner/complaints" : "/driver/complaints",
      isRead: false,
    });

    return res.json({
      success: true,
      message: "User unblock ho gaya",
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getAllComplaints = async (req, res) => {
  try {
    const { status, state, search, page = 1, limit = DEFAULT_LIMIT } = req.query;

    const query = {};
    if (status) query.status = status;
    if (state) query["location.state"] = state;
    if (search) {
      const t = String(search).trim();
      query.description = { $regex: escapeRegex(t), $options: "i" };
    }

    const lim = Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT);
    const pg = Math.max(Number(page) || 1, 1);

    // Parallel - complaints + total (2x faster)
    const [complaints, total] = await Promise.all([
      Complaint.find(query)
        .populate("raisedBy", "name phone role location")
        .populate("againstUser", "name phone role location")
        .populate("jobId", "title vehicleType")
        .sort({ createdAt: -1 })
        .limit(lim)
        .skip((pg - 1) * lim)
        .lean(),
      Complaint.countDocuments(query),
    ]);

    return res.json({
      success: true,
      complaints,
      total,
      page: pg,
      totalPages: Math.ceil(total / lim) || 0,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const resolveComplaint = async (req, res) => {
  try {
    const { complaintId, action, adminNote, blockDays } = req.body;

    // Validations
    if (!isValidObjectId(complaintId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid complaint ID",
      });
    }

    if (!adminNote || !String(adminNote).trim()) {
      return res.status(400).json({
        success: false,
        message: "Admin note zaroori hai",
      });
    }

    const actionVal = action || "no_action";
    if (!ALLOWED_ACTIONS.includes(actionVal)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action",
      });
    }

    const note = String(adminNote).trim().slice(0, MAX_NOTE_LENGTH);

    // Get complaint with population
    const complaint = await Complaint.findById(complaintId)
      .populate("raisedBy", "name")
      .populate("againstUser", "name role");

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint nahi mili",
      });
    }

    complaint.status = "resolved";
    complaint.adminNote = note;
    complaint.adminAction = actionVal;
    complaint.resolvedAt = new Date();

    const targetUser = complaint.againstUser;
    const targetComplaintLink =
      targetUser?.role === "owner" ? "/owner/complaints" : "/driver/complaints";

    // Prepare parallel writes
    const writes = [complaint.save()];

    if (actionVal !== "no_action" && targetUser) {
      if (actionVal === "warning") {
        // Just notification - no user update
      } else if (
        actionVal === "blocked_30days" ||
        actionVal === "blocked_90days"
      ) {
        const days =
          actionVal === "blocked_90days"
            ? Number(blockDays) || DAYS_90
            : Number(blockDays) || DAYS_30;
        writes.push(
          User.findByIdAndUpdate(targetUser._id, {
            isBlocked: true,
            blockReason: note,
            blockedAt: new Date(),
            blockUntil: new Date(Date.now() + days * MS_PER_DAY),
          })
        );
      } else if (actionVal === "permanent_ban") {
        writes.push(
          User.findByIdAndUpdate(targetUser._id, {
            isBlocked: true,
            blockReason: note,
            blockedAt: new Date(),
            blockUntil: null,
          })
        );
      }
    }

    // Execute all writes in parallel
    await Promise.all(writes);

    // Non-blocking notifications based on action
    if (actionVal !== "no_action" && targetUser) {
      if (actionVal === "warning") {
        createNotificationSafe({
          userId: targetUser._id,
          title: "Admin Warning",
          message: `A complaint against you was resolved. You received a warning. ${note}`,
          type: "complaint_update",
          link: targetComplaintLink,
          isRead: false,
        });
      } else if (
        actionVal === "blocked_30days" ||
        actionVal === "blocked_90days"
      ) {
        const days =
          actionVal === "blocked_90days"
            ? Number(blockDays) || DAYS_90
            : Number(blockDays) || DAYS_30;
        createNotificationSafe({
          userId: targetUser._id,
          title: `Account Blocked (${days} days)`,
          message: `Your account was blocked for ${days} days. ${note}`,
          type: "complaint_update",
          link: targetComplaintLink,
          isRead: false,
        });
      } else if (actionVal === "permanent_ban") {
        createNotificationSafe({
          userId: targetUser._id,
          title: "Account Permanently Banned",
          message: `Your account was permanently banned. ${note}`,
          type: "complaint_update",
          link: targetComplaintLink,
          isRead: false,
        });
      }
    }

    // Notify raiser
    const raiser = complaint.raisedBy;
    if (raiser) {
      const link =
        complaint.raisedByRole === "driver"
          ? "/driver/complaints"
          : "/owner/complaints";
      createNotificationSafe({
        userId: raiser._id,
        title: "Complaint Resolved",
        message: `Your complaint was resolved. Admin note: ${note}`,
        type: "complaint_update",
        link,
        isRead: false,
      });
    }

    return res.json({
      success: true,
      message: "Complaint resolve ho gayi",
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getSubscriptions = async (req, res) => {
  try {
    const { role, status, page = 1, limit = DEFAULT_LIMIT } = req.query;

    const query = {};
    if (role) query.role = role;
    if (status) query.status = status;

    const lim = Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT);
    const pg = Math.max(Number(page) || 1, 1);

    // Parallel - subs + total
    const [subscriptions, total] = await Promise.all([
      Subscription.find(query)
        .populate("userId", "name phone role location")
        .sort({ createdAt: -1 })
        .limit(lim)
        .skip((pg - 1) * lim)
        .lean(),
      Subscription.countDocuments(query),
    ]);

    return res.json({
      success: true,
      subscriptions,
      total,
      page: pg,
      totalPages: Math.ceil(total / lim) || 0,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const verifyUser = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Atomic - update + get role in 1 query (was 2)
    const user = await User.findByIdAndUpdate(
      userId,
      { isVerified: true },
      { new: true }
    )
      .select("role")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila",
      });
    }

    // Non-blocking notification
    createNotificationSafe({
      userId,
      title: "Account Verified!",
      message: "Your account was verified. You will now have a verified badge.",
      type: "complaint_update",
      link: user.role === "owner" ? "/owner/complaints" : "/driver/complaints",
      isRead: false,
    });

    return res.json({
      success: true,
      message: "User verify ho gaya",
    });
  } catch (error) {
    return sendServerError(res);
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  blockUser,
  unblockUser,
  getAllComplaints,
  resolveComplaint,
  getSubscriptions,
  verifyUser,
};
