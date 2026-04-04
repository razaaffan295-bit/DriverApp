const Complaint = require("../models/Complaint");
const User = require("../models/User");
const Notification = require("../models/Notification");

const uid = (req) => req.user._id || req.user.id;

const createComplaint = async (req, res) => {
  try {
    const {
      againstUserId,
      jobId: jobIdRaw,
      contractId: contractIdRaw,
      type,
      description,
      evidence: evidenceRaw,
    } = req.body;

    const jobId =
      jobIdRaw && String(jobIdRaw).trim() ? jobIdRaw : null;
    const contractId =
      contractIdRaw && String(contractIdRaw).trim()
        ? contractIdRaw
        : null;

    let evidenceUrls = [];
    if (req.files && req.files.length > 0) {
      evidenceUrls = req.files
        .map((f) => f.path || f.secure_url || f.url || "")
        .filter(Boolean);
    } else if (evidenceRaw != null && evidenceRaw !== "") {
      try {
        const parsed =
          typeof evidenceRaw === "string"
            ? JSON.parse(evidenceRaw)
            : evidenceRaw;
        if (Array.isArray(parsed)) {
          evidenceUrls = parsed.filter(
            (u) => typeof u === "string" && u.trim()
          );
        }
      } catch {
        /* ignore invalid JSON */
      }
    }

    if (!againstUserId || !type || !description) {
      return res.status(400).json({
        success: false,
        message: "Sab fields required hain",
      });
    }

    if (req.user.role !== "owner" && req.user.role !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Sirf owner ya driver complaint kar sakte hain",
      });
    }

    const againstUser = await User.findById(againstUserId);
    if (!againstUser) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila",
      });
    }

    const complaint = await Complaint.create({
      raisedBy: uid(req),
      againstUser: againstUserId,
      jobId: jobId || null,
      contractId: contractId || null,
      raisedByRole: req.user.role,
      type,
      description: String(description).trim(),
      evidence: evidenceUrls,
      location: {
        state: req.user.location?.state,
        district: req.user.location?.district,
      },
      status: "pending",
    });

    const admins = await User.find({ role: "admin" });

    for (const admin of admins) {
      await Notification.create({
        userId: admin._id,
        title: "Nayi Complaint Aayi!",
        message: `${req.user.name} ne ${againstUser.name} ke khilaf complaint ki: ${type}`,
        type: "complaint_update",
        link: "/admin/complaints",
        isRead: false,
      });
    }

    return res.json({
      success: true,
      complaint,
      message:
        "Complaint darj ho gayi. Admin review karega.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getMyComplaints = async (req, res) => {
  try {
    const id = uid(req);
    const complaints = await Complaint.find({
      $or: [{ raisedBy: id }, { againstUser: id }],
    })
      .populate("raisedBy", "name role")
      .populate("againstUser", "name role")
      .populate("jobId", "title vehicleType")
      .sort({ createdAt: -1 });

    return res.json({ success: true, complaints });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getComplaintById = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate("raisedBy", "name role phone")
      .populate("againstUser", "name role phone")
      .populate("jobId", "title vehicleType");

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint nahi mili",
      });
    }

    const me = String(uid(req));
    const ok =
      req.user.role === "admin" ||
      String(complaint.raisedBy?._id || complaint.raisedBy) === me ||
      String(complaint.againstUser?._id || complaint.againstUser) === me;

    if (!ok) {
      return res.status(403).json({
        success: false,
        message: "Access nahi hai",
      });
    }

    return res.json({ success: true, complaint });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createComplaint,
  getMyComplaints,
  getComplaintById,
};
