const mongoose = require("mongoose");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const User = require("../models/User");
const Application = require("../models/Application");
const Contract = require("../models/Contract");
const DriverInvite = require("../models/DriverInvite");

// Constants
const MAX_MESSAGE_LENGTH = 2000;
const MESSAGE_PAGE_LIMIT = 100;
const CONVERSATION_LIMIT = 500;
const PREVIEW_LENGTH = 40;

const uidFromReq = (req) => req.user._id || req.user.id;

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

const sendMessage = async (req, res) => {
  try {
    const { jobId, receiverId, message } = req.body;
    const senderId = uidFromReq(req);

    // Required fields
    if (!receiverId || !message) {
      return res.status(400).json({
        success: false,
        message: "receiverId aur message required hai",
      });
    }

    // ObjectId validation
    if (!isValidObjectId(receiverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid receiver ID",
      });
    }

    // Self-message prevention
    if (String(receiverId) === String(senderId)) {
      return res.status(400).json({
        success: false,
        message: "Aap apne aap ko message nahi bhej sakte",
      });
    }

    // Optional jobId validation
    if (jobId && !isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID",
      });
    }

    // Message text validation
    const text = String(message).trim();
    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Message empty nahi ho sakta",
      });
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Message ${MAX_MESSAGE_LENGTH} characters se kam hona chahiye`,
      });
    }

    // Relationship check - parallel (4x faster)
    const [app, contract, invite, prevMsg] = await Promise.all([
      Application.findOne({
        $or: [
          { ownerId: senderId, driverId: receiverId },
          { ownerId: receiverId, driverId: senderId },
        ],
      })
        .select("_id")
        .lean(),
      Contract.findOne({
        $or: [
          { ownerId: senderId, driverId: receiverId },
          { ownerId: receiverId, driverId: senderId },
        ],
      })
        .select("_id")
        .lean(),
      DriverInvite.findOne({
        $or: [
          { ownerId: senderId, driverId: receiverId },
          { ownerId: receiverId, driverId: senderId },
        ],
      })
        .select("_id")
        .lean(),
      Message.findOne({
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      })
        .select("_id")
        .lean(),
    ]);

    if (!app && !contract && !invite && !prevMsg) {
      return res.status(403).json({
        success: false,
        message: "No relationship with this user",
      });
    }

    // Create message
    const newMessage = await Message.create({
      jobId: jobId || null,
      senderId,
      receiverId,
      message: text,
      isRead: false,
    });

    // PARALLEL - populate message + get sender + get receiver (3x faster)
    const [populated, sender, receiverUser] = await Promise.all([
      Message.findById(newMessage._id)
        .populate("senderId", "name role")
        .populate("receiverId", "name role")
        .lean(),
      User.findById(senderId).select("name role").lean(),
      User.findById(receiverId).select("role").lean(),
    ]);

    // Non-blocking notification
    const previewBody =
      text.length > PREVIEW_LENGTH
        ? `${text.substring(0, PREVIEW_LENGTH)}...`
        : text;

    createNotificationSafe({
      userId: receiverId,
      title: "New Message!",
      message: `${sender?.name || "Someone"} sent you a message: "${previewBody}"`,
      type: "new_message",
      link:
        receiverUser?.role === "driver"
          ? "/driver/messages"
          : "/owner/messages",
      isRead: false,
    });

    return res.json({
      success: true,
      message: populated,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getMessages = async (req, res) => {
  try {
    const { jobId, otherUserId } = req.params;
    const userId = uidFromReq(req);

    if (!otherUserId || otherUserId === "undefined") {
      return res.status(400).json({
        success: false,
        message: "otherUserId required",
      });
    }

    // ObjectId validation
    if (!isValidObjectId(otherUserId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const hasValidJobId =
      jobId && jobId !== "undefined" && jobId !== "none";

    if (hasValidJobId && !isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID",
      });
    }

    const query = {
      $or: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
    };

    if (hasValidJobId) {
      query.jobId = jobId;
    }

    const markFilter = {
      senderId: otherUserId,
      receiverId: userId,
      isRead: false,
      ...(hasValidJobId ? { jobId } : {}),
    };

    // PARALLEL - get messages + mark as read (2x faster)
    const [messages] = await Promise.all([
      Message.find(query)
        .populate("senderId", "name role")
        .sort({ createdAt: 1 })
        .limit(MESSAGE_PAGE_LIMIT)
        .lean(),
      Message.updateMany(markFilter, {
        $set: { isRead: true },
      }),
    ]);

    return res.json({
      success: true,
      messages,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getConversations = async (req, res) => {
  try {
    const userId = uidFromReq(req);
    const uidStr = userId.toString();

    // Limit to recent messages (DOS protection)
    const messages = await Message.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    })
      .populate("jobId", "title vehicleType status")
      .populate("senderId", "name role")
      .populate("receiverId", "name role")
      .sort({ createdAt: -1 })
      .limit(CONVERSATION_LIMIT)
      .lean();

    const conversationMap = {};

    for (const msg of messages) {
      const senderDoc = msg.senderId;
      const receiverDoc = msg.receiverId;
      const senderIdStr = (senderDoc?._id ?? senderDoc).toString();
      const receiverIdStr = (receiverDoc?._id ?? receiverDoc).toString();

      const otherUserId =
        senderIdStr === uidStr ? receiverIdStr : senderIdStr;

      const jobRef = msg.jobId;
      const jobIdStr =
        jobRef && jobRef._id
          ? String(jobRef._id)
          : msg.jobId
            ? String(msg.jobId)
            : "no-job";

      const key = `${jobIdStr}-${otherUserId}`;

      if (!conversationMap[key]) {
        const otherUser =
          senderIdStr === uidStr ? receiverDoc : senderDoc;
        conversationMap[key] = {
          jobId:
            jobRef && jobRef._id
              ? jobRef
              : { _id: null, title: "Chat" },
          otherUserId,
          otherUser,
          lastMessage: msg.message,
          lastMessageTime: msg.createdAt,
          unreadCount: 0,
        };
      } else {
        const prevTime = new Date(
          conversationMap[key].lastMessageTime
        ).getTime();
        const msgTime = new Date(msg.createdAt).getTime();
        if (msgTime > prevTime) {
          conversationMap[key].lastMessage = msg.message;
          conversationMap[key].lastMessageTime = msg.createdAt;
        }
      }

      if (receiverIdStr === uidStr && !msg.isRead) {
        conversationMap[key].unreadCount++;
      }
    }

    const conversations = Object.values(conversationMap);

    return res.json({
      success: true,
      conversations,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

module.exports = {
  sendMessage,
  getMessages,
  getConversations,
};
