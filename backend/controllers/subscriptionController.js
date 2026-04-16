const crypto = require("crypto");
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const Notification = require("../models/Notification");

const userIdFromReq = (req) => req.user._id || req.user.id;

const createOrder = async (req, res) => {
  try {
    const razorpay = require("../config/razorpay");
    const User = require("../models/User");
    const user = await User.findById(req.user.id);

    console.log("User:", user?.name, user?.role);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila",
      });
    }

    const amount = user.role === "owner" ? 49900 : 9900;

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    });

    res.json({
      success: true,
      order,
      key: process.env.RAZORPAY_KEY_ID,
      amount,
      user: {
        name: user.name,
        contact: user.phone,
        email: "",
      },
    });
  } catch (error) {
    console.error("Order error:", error.message);
    console.error("Full error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSign !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verify nahi hua",
      });
    }

    const user = await User.findById(userIdFromReq(req));
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila",
      });
    }

    const amount = user.role === "owner" ? 499 : 99;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    await Subscription.create({
      userId: userIdFromReq(req),
      role: user.role,
      amount,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      startDate,
      endDate,
      status: "active",
    });

    await User.findByIdAndUpdate(userIdFromReq(req), {
      "subscription.isActive": true,
      "subscription.startDate": startDate,
      "subscription.endDate": endDate,
      "subscription.razorpayPaymentId": razorpay_payment_id,
    });

    await Notification.create({
      userId: userIdFromReq(req),
      title: "Subscription Active!",
      message: `Your ₹${amount}/month subscription is active. Valid for 30 days.`,
      type: "payment_received",
      link:
        user.role === "owner"
          ? "/owner/post-job"
          : "/driver/jobs",
      isRead: false,
    });

    res.json({
      success: true,
      message:
        "Payment successful! Subscription active ho gayi.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const checkSubscription = async (req, res) => {
  try {
    const user = await User.findById(userIdFromReq(req));
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila",
      });
    }

    // Permanent free users
    if (user.isPermanentFree) {
      return res.json({
        success: true,
        isActive: true,
        isPermanentFree: true,
        endDate: null,
        role: user.role,
        amount: user.role === 'owner' ? 499 : 99,
      })
    }

    // If subscription not required yet - free trial
    if (!user.subscriptionRequired) {
      return res.json({
        success: true,
        isActive: true,
        isFreeTrialActive: true,
        freeTrialStart: user.freeTrialStart,
        endDate: null,
        role: user.role,
        amount: user.role === 'owner' ? 499 : 99,
      })
    }

    // Subscription required - check if paid
    const isActive =
      user.subscription?.isActive === true &&
      user.subscription?.endDate &&
      new Date(user.subscription.endDate) > new Date()

    // Check deadline passed
    const deadlinePassed = user.subscriptionDeadline
      ? new Date(user.subscriptionDeadline) < new Date()
      : false

    return res.json({
      success: true,
      isActive: isActive,
      subscriptionRequired: user.subscriptionRequired,
      subscriptionDeadline: user.subscriptionDeadline,
      deadlinePassed,
      endDate: user.subscription?.endDate,
      role: user.role,
      amount: user.role === 'owner' ? 499 : 99,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  checkSubscription,
};
