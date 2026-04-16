const Message = require("../models/Message");
const Notification = require("../models/Notification");
const User = require("../models/User");

const uidFromReq = (req) => req.user._id || req.user.id;

const sendMessage = async (req, res) => {
  try {
    const { jobId, receiverId, message } = req.body;

    if (!receiverId || !message) {
      return res.status(400).json({
        success: false,
        message: "receiverId aur message required hai",
      });
    }

    if (!String(message).trim()) {
      return res.status(400).json({
        success: false,
        message: "Message empty nahi ho sakta",
      });
    }

    const text = String(message).trim();

    const newMessage = await Message.create({
      jobId: jobId || null,
      senderId: uidFromReq(req),
      receiverId,
      message: text,
      isRead: false,
    });

    const populated = await Message.findById(newMessage._id)
      .populate("senderId", "name role")
      .populate("receiverId", "name role");

    const sender = await User.findById(uidFromReq(req)).select(
      "name role"
    );
    const receiverUser = await User.findById(receiverId).select(
      "role"
    );

    const previewBody =
      text.length > 40 ? `${text.substring(0, 40)}...` : text;
    await Notification.create({
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
    console.error("sendMessage:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
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

    const query = {
      $or: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
    };

    if (
      jobId &&
      jobId !== "undefined" &&
      jobId !== "none"
    ) {
      query.jobId = jobId;
    }

    const messages = await Message.find(query)
      .populate("senderId", "name role")
      .sort({ createdAt: 1 });

    const markFilter = {
      senderId: otherUserId,
      receiverId: userId,
      isRead: false,
      ...(jobId &&
      jobId !== "undefined" &&
      jobId !== "none"
        ? { jobId }
        : {}),
    };

    await Message.updateMany(markFilter, {
      $set: { isRead: true },
    });

    return res.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("getMessages error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getConversations = async (req, res) => {
  try {
    const userId = uidFromReq(req);
    const uidStr = userId.toString();

    const messages = await Message.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    })
      .populate("jobId", "title vehicleType status")
      .populate("senderId", "name role")
      .populate("receiverId", "name role")
      .sort({ createdAt: -1 });

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
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

module.exports = {
  sendMessage,
  getMessages,
  getConversations,
};
