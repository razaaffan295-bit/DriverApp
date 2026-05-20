const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const Notification = require("../models/Notification");
const razorpay = require("../config/razorpay");

// Constants
const OWNER_AMOUNT_PAISE = 49900; // ₹499
const DRIVER_AMOUNT_PAISE = 9900; // ₹99
const OWNER_AMOUNT_RS = 499;
const DRIVER_AMOUNT_RS = 99;
const SUBSCRIPTION_DAYS = 30;

const userIdFromReq = (req) => req.user._id || req.user.id;

// Helpers
const sendServerError = (res) => {
  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Server error'
      : undefined,
  });
};

const getAmountInPaise = (role) =>
  role === "owner" ? OWNER_AMOUNT_PAISE : DRIVER_AMOUNT_PAISE;

const getAmountInRs = (role) =>
  role === "owner" ? OWNER_AMOUNT_RS : DRIVER_AMOUNT_RS;

const createNotificationSafe = (data) => {
  Notification.create(data).catch(() => {
    // Silent fail - notification shouldn't break payment
  });
};

const hasActiveSubscription = (user) => {
  return (
    user.subscription?.isActive === true &&
    user.subscription?.endDate &&
    new Date(user.subscription.endDate) > new Date()
  );
};

const createOrder = async (req, res) => {
  try {
    const userId = userIdFromReq(req);

    const user = await User.findById(userId)
      .select("_id role name phone subscription isPermanentFree")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila",
      });
    }

    // Block duplicate payment - user already has active subscription
    if (user.isPermanentFree) {
      return res.status(400).json({
        success: false,
        message: "Aapko subscription ki zaroorat nahi hai",
      });
    }

    if (hasActiveSubscription(user)) {
      return res.status(400).json({
        success: false,
        message: "Aapki subscription pehle se active hai",
        code: "ALREADY_SUBSCRIBED",
      });
    }

    const amount = getAmountInPaise(user.role);

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: {
        userId: String(user._id),
        role: user.role,
      },
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
    return sendServerError(res);
  }
};

const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const userId = userIdFromReq(req);

    // Required fields check
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment details missing",
      });
    }

    // STEP 1: Cryptographic signature verification (PROOF OF PAYMENT)
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

    // STEP 2: Parallel - check duplicate + get user (2x faster)
    const [existingSub, user] = await Promise.all([
      Subscription.findOne({
        razorpayPaymentId: razorpay_payment_id,
      })
        .select("_id")
        .lean(),
      User.findById(userId)
        .select("_id role")
        .lean(),
    ]);

    // Idempotency - already processed
    if (existingSub) {
      return res.json({
        success: true,
        message: "Payment already verified",
        alreadyProcessed: true,
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila",
      });
    }

    // STEP 3: Verify order details with Razorpay
    try {
      const order = await razorpay.orders.fetch(razorpay_order_id);
      const expectedAmount = getAmountInPaise(user.role);

      if (order.amount !== expectedAmount) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment amount",
        });
      }

      // NOTE: We DO NOT check order.status === "paid"
      // Reason: Signature verification is cryptographic proof of payment.
      // order.status updates asynchronously via webhook and may still be
      // "created" or "attempted" at this point even after successful payment.
      // Trusting signature is per Razorpay's recommended flow.

      if (
        order.notes?.userId &&
        String(order.notes.userId) !== String(userId)
      ) {
        return res.status(403).json({
          success: false,
          message: "Order does not belong to this user",
        });
      }
    } catch (orderErr) {
      return res.status(400).json({
        success: false,
        message: "Could not verify order",
      });
    }

    // STEP 4: Update DB - user FIRST (safer if sub create fails)
    const amount = getAmountInRs(user.role);
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + SUBSCRIPTION_DAYS);

    // Update user subscription status FIRST
    await User.findByIdAndUpdate(userId, {
      "subscription.isActive": true,
      "subscription.startDate": startDate,
      "subscription.endDate": endDate,
      "subscription.razorpayPaymentId": razorpay_payment_id,
    });

    // Then create subscription record (for audit trail)
    await Subscription.create({
      userId,
      role: user.role,
      amount,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      startDate,
      endDate,
      status: "active",
    });

    // Non-blocking notification (won't slow response)
    createNotificationSafe({
      userId,
      title: "Subscription Active!",
      message: `Your ₹${amount}/month subscription is active. Valid for 30 days.`,
      type: "payment_received",
      link: user.role === "owner" ? "/owner/post-job" : "/driver/jobs",
      isRead: false,
    });

    res.json({
      success: true,
      message: "Payment successful! Subscription active ho gayi.",
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const checkSubscription = async (req, res) => {
  try {
    const user = await User.findById(userIdFromReq(req))
      .select(
        "role isPermanentFree subscriptionRequired freeTrialStart subscription subscriptionDeadline"
      )
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila",
      });
    }

    const amount = getAmountInRs(user.role);

    // Permanent free users
    if (user.isPermanentFree) {
      return res.json({
        success: true,
        isActive: true,
        isPermanentFree: true,
        endDate: null,
        role: user.role,
        amount,
      });
    }

    // Free trial active
    if (!user.subscriptionRequired) {
      return res.json({
        success: true,
        isActive: true,
        isFreeTrialActive: true,
        freeTrialStart: user.freeTrialStart,
        endDate: null,
        role: user.role,
        amount,
      });
    }

    // Paid subscription check
    const isActive = hasActiveSubscription(user);
    const deadlinePassed = user.subscriptionDeadline
      ? new Date(user.subscriptionDeadline) < new Date()
      : false;

    return res.json({
      success: true,
      isActive,
      subscriptionRequired: user.subscriptionRequired,
      subscriptionDeadline: user.subscriptionDeadline,
      deadlinePassed,
      endDate: user.subscription?.endDate,
      role: user.role,
      amount,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  checkSubscription,
};
