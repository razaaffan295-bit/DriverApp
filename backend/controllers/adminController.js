const User = require("../models/User");
const Job = require("../models/Job");
const Contract = require("../models/Contract");
const Complaint = require("../models/Complaint");
const Subscription = require("../models/Subscription");
const Vehicle = require("../models/Vehicle");
const DriverProfile = require("../models/DriverProfile");
const Notification = require("../models/Notification");

const getDashboardStats = async (req, res) => {
  try {
    const totalOwners = await User.countDocuments({ role: "owner" });
    const totalDrivers = await User.countDocuments({ role: "driver" });
    const totalJobs = await Job.countDocuments();
    const activeJobs = await Job.countDocuments({ status: "open" });
    const activeContracts = await Contract.countDocuments({
      status: "active",
    });
    const pendingComplaints = await Complaint.countDocuments({
      status: "pending",
    });

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const monthlySubscriptions = await Subscription.find({
      createdAt: {
        $gte: new Date(currentYear, currentMonth - 1, 1),
      },
      status: "active",
    });

    const monthlyRevenue = monthlySubscriptions.reduce(
      (sum, s) => sum + (Number(s.amount) || 0),
      0
    );

    const totalRevenue = await Subscription.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const ownerRevenue = await Subscription.aggregate([
      { $match: { role: "owner", status: "active" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const driverRevenue = await Subscription.aggregate([
      { $match: { role: "driver", status: "active" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

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
    return res.status(500).json({
      success: false,
      message: error.message,
    });
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
      limit = 20,
    } = req.query;

    const query = {};
    if (role) query.role = role;
    if (state) query["location.state"] = state;

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

    if (search) {
      const term = String(search).trim();
      query.$or = [
        { name: { $regex: term, $options: "i" } },
        { phone: { $regex: term, $options: "i" } },
      ];
    }

    const lim = Math.min(Number(limit) || 20, 100);
    const pg = Math.max(Number(page) || 1, 1);

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(lim)
      .skip((pg - 1) * lim);

    const total = await User.countDocuments(query);

    const usersWithDetails = await Promise.all(
      users.map(async (user) => {
        if (user.role === "owner") {
          const vehicles = await Vehicle.find({
            ownerId: user._id,
          }).select("vehicleType vehicleNumber");
          return { ...user.toObject(), vehicles };
        }
        if (user.role === "driver") {
          const profile = await DriverProfile.findOne({
            driverId: user._id,
          }).select("skills experience");
          return { ...user.toObject(), driverProfile: profile };
        }
        return user.toObject();
      })
    );

    return res.json({
      success: true,
      users: usersWithDetails,
      total,
      page: pg,
      totalPages: Math.ceil(total / lim) || 0,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const blockUser = async (req, res) => {
  try {
    const { userId, reason, blockDays } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila",
      });
    }

    user.isBlocked = true;
    user.blockReason = reason || "Admin action";
    user.blockedAt = new Date();

    if (blockDays && Number(blockDays) > 0) {
      user.blockUntil = new Date(
        Date.now() + Number(blockDays) * 24 * 60 * 60 * 1000
      );
    } else {
      user.blockUntil = null;
    }

    await user.save();

    await Notification.create({
      userId: user._id,
      title: "Account Block Ho Gaya",
      message:
        reason || "Aapka account block kar diya gaya hai.",
      type: "complaint_update",
      isRead: false,
    });

    return res.json({
      success: true,
      message: "User block ho gaya",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const unblockUser = async (req, res) => {
  try {
    const { userId } = req.body;

    await User.findByIdAndUpdate(userId, {
      isBlocked: false,
      blockReason: "",
      blockUntil: null,
    });

    await Notification.create({
      userId,
      title: "Account Unblock Ho Gaya",
      message: "Aapka account unblock kar diya gaya hai.",
      type: "complaint_update",
      isRead: false,
    });

    return res.json({
      success: true,
      message: "User unblock ho gaya",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getAllComplaints = async (req, res) => {
  try {
    const { status, state, search, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (state) query["location.state"] = state;
    if (search) {
      const t = String(search).trim();
      query.description = { $regex: t, $options: "i" };
    }

    const lim = Math.min(Number(limit) || 20, 100);
    const pg = Math.max(Number(page) || 1, 1);

    const complaints = await Complaint.find(query)
      .populate("raisedBy", "name phone role location")
      .populate("againstUser", "name phone role location")
      .populate("jobId", "title vehicleType")
      .sort({ createdAt: -1 })
      .limit(lim)
      .skip((pg - 1) * lim);

    const total = await Complaint.countDocuments(query);

    return res.json({
      success: true,
      complaints,
      total,
      page: pg,
      totalPages: Math.ceil(total / lim) || 0,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const resolveComplaint = async (req, res) => {
  try {
    const { complaintId, action, adminNote, blockDays } = req.body;

    if (!adminNote || !String(adminNote).trim()) {
      return res.status(400).json({
        success: false,
        message: "Admin note zaroori hai",
      });
    }

    const complaint = await Complaint.findById(complaintId)
      .populate("raisedBy", "name")
      .populate("againstUser", "name");

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint nahi mili",
      });
    }

    complaint.status = "resolved";
    complaint.adminNote = String(adminNote).trim();
    complaint.adminAction = action || "no_action";
    complaint.resolvedAt = new Date();
    await complaint.save();

    const note = complaint.adminNote;
    const targetUser = complaint.againstUser;

    if (action && action !== "no_action" && targetUser) {
      if (action === "warning") {
        await Notification.create({
          userId: targetUser._id,
          title: "Admin Warning",
          message: `Aapke khilaf complaint resolve hui. Admin ne warning di hai. ${note}`,
          type: "complaint_update",
          isRead: false,
        });
      }

      if (action === "blocked_30days" || action === "blocked_90days") {
        const days =
          action === "blocked_90days"
            ? Number(blockDays) || 90
            : Number(blockDays) || 30;
        await User.findByIdAndUpdate(targetUser._id, {
          isBlocked: true,
          blockReason: note,
          blockedAt: new Date(),
          blockUntil: new Date(
            Date.now() + days * 24 * 60 * 60 * 1000
          ),
        });

        await Notification.create({
          userId: targetUser._id,
          title: `Account ${days} Din ke liye Block`,
          message: `Complaint ke baad aapka account ${days} din ke liye block. ${note}`,
          type: "complaint_update",
          isRead: false,
        });
      }

      if (action === "permanent_ban") {
        await User.findByIdAndUpdate(targetUser._id, {
          isBlocked: true,
          blockReason: note,
          blockedAt: new Date(),
          blockUntil: null,
        });

        await Notification.create({
          userId: targetUser._id,
          title: "Account Permanently Ban",
          message: `Aapka account permanently ban ho gaya. ${note}`,
          type: "complaint_update",
          isRead: false,
        });
      }
    }

    const raiser = complaint.raisedBy;
    if (raiser) {
      const link =
        complaint.raisedByRole === "driver"
          ? "/driver/complaints"
          : "/owner/complaints";
      await Notification.create({
        userId: raiser._id,
        title: "Complaint Resolve Ho Gayi",
        message: `Aapki complaint resolve ho gayi. Admin note: ${note}`,
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
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getSubscriptions = async (req, res) => {
  try {
    const { role, status } = req.query;

    const query = {};
    if (role) query.role = role;
    if (status) query.status = status;

    const subscriptions = await Subscription.find(query)
      .populate("userId", "name phone role location")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      subscriptions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const verifyUser = async (req, res) => {
  try {
    const { userId } = req.body;

    await User.findByIdAndUpdate(userId, { isVerified: true });

    await Notification.create({
      userId,
      title: "Account Verified!",
      message:
        "Aapka account verify ho gaya. Ab Verified badge milega.",
      type: "complaint_update",
      isRead: false,
    });

    return res.json({
      success: true,
      message: "User verify ho gaya",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
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
