const Payment = require("../models/Payment");
const Advance = require("../models/Advance");
const Contract = require("../models/Contract");
const DriverAttendance = require("../models/DriverAttendance");
const Notification = require("../models/Notification");
const DriverProfile = require("../models/DriverProfile");

const uidFromReq = (req) => req.user._id || req.user.id;

const activeContractDriver = (driverId) =>
  Contract.findOne({ driverId, status: "active" }).sort({
    createdAt: -1,
  });

const activeContractOwner = async (ownerId, contractIdQuery) => {
  if (contractIdQuery) {
    const c = await Contract.findById(contractIdQuery);
    if (!c || String(c.ownerId) !== String(ownerId)) return null;
    if (c.status !== "active") return null;
    return c;
  }
  return Contract.findOne({ ownerId, status: "active" }).sort({
    createdAt: -1,
  });
};

const getPaymentSummary = async (req, res) => {
  try {
    const uid = uidFromReq(req);
    let contract;
    if (req.user.role === "driver") {
      contract = await activeContractDriver(uid);
    } else {
      contract = await activeContractOwner(uid, req.query.contractId);
    }

    if (!contract) {
      return res.status(400).json({
        success: false,
        message: "Koi active contract nahi",
      });
    }

    const cid = contract._id;
    const driverIdForAttendance =
      contract.driverId?._id || contract.driverId;
    const records = await DriverAttendance.find({
      contractId: cid,
      driverId: driverIdForAttendance,
    })
      .select("month year salaryForDay")
      .lean();

    const totalSalaryEarned = records.reduce(
      (sum, r) => sum + (Number(r.salaryForDay) || 0),
      0
    );

    const byMonthYear = new Map();
    for (const r of records) {
      const key = `${r.year}-${r.month}`;
      const prev = byMonthYear.get(key) || {
        month: r.month,
        year: r.year,
        totalSalaryEarned: 0,
      };
      prev.totalSalaryEarned += Number(r.salaryForDay) || 0;
      byMonthYear.set(key, prev);
    }
    const attendanceBreakdown = Array.from(byMonthYear.values()).sort(
      (a, b) => b.year - a.year || b.month - a.month
    );

    const confirmedPayments = await Payment.find({
      contractId: cid,
      status: "paid",
      driverConfirmed: true,
    });
    const totalPaid = confirmedPayments.reduce(
      (sum, p) => sum + (Number(p.netAmount) || 0),
      0
    );

    const activeAdvances = await Advance.find({
      contractId: cid,
      status: { $in: ["approved", "partial"] },
      isCleared: false,
    });

    const totalAdvanceRemaining = activeAdvances.reduce(
      (sum, a) => sum + (Number(a.remaining) || 0),
      0
    );
    const totalAdvance = activeAdvances.reduce(
      (sum, a) => sum + (Number(a.approvedAmount) || 0),
      0
    );
    const totalAdvanceRepaid = activeAdvances.reduce(
      (sum, a) => sum + (Number(a.totalRepaid) || 0),
      0
    );

    const netDue =
      Math.round(
        (totalSalaryEarned -
          totalPaid -
          totalAdvanceRemaining) *
          100
      ) / 100;

    const pendingPayments = await Payment.find({
      contractId: cid,
      ownerMarkedPaid: true,
      driverConfirmed: false,
      driverRejected: false,
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .populate("driverId", "name phone")
      .lean();

    const contractPop = await Contract.findById(cid)
      .populate(
        "jobId",
        "title vehicleType salaryType vehicleCategory salaryPerDay salaryPerMonth salaryPerHour dailyBhatta hasHourlyBonus"
      )
      .populate("driverId", "name phone")
      .lean();

    const pendingRequests = await Payment.find({
      contractId: cid,
      status: "pending",
      ownerMarkedPaid: false,
      isDriverRequested: true,
    })
      .sort({ createdAt: -1 })
      .populate("driverId", "name phone")
      .lean();

    const dp = await DriverProfile.findOne({
      driverId: contract.driverId,
    })
      .select("bankDetails")
      .lean();
    const driverBankDetails = dp?.bankDetails || null;

    return res.json({
      success: true,
      summary: {
        totalSalaryEarned,
        totalPaid,
        totalAdvance,
        totalAdvanceRepaid,
        totalAdvanceRemaining,
        netDue,
        contract: contractPop,
        attendance: attendanceBreakdown,
        pendingRequests,
        pendingPayments,
        driverBankDetails,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const makePayment = async (req, res) => {
  try {
    const ownerId = uidFromReq(req);
    const {
      contractId,
      driverId,
      amount,
      paymentType,
      utrNumber,
      paymentPhoto,
      witnessName,
      note,
      advanceDeduction,
      advanceId,
      month,
      year,
    } = req.body;

    const amt = Number(amount);
    if (!contractId || !driverId || !amt || amt <= 0) {
      return res.status(400).json({
        success: false,
        message: "contractId, driverId aur amount zaroori hain",
      });
    }

    const m = Number(month);
    const y = Number(year);
    if (!m || m < 1 || m > 12 || !y) {
      return res.status(400).json({
        success: false,
        message: "month aur year sahi se bhejein",
      });
    }

    const pt = paymentType === "cash" ? "cash" : "upi";
    if (pt === "upi" && (!utrNumber || !String(utrNumber).trim())) {
      return res.status(400).json({
        success: false,
        message: "UPI ke liye UTR zaroori hai",
      });
    }

    const contract = await Contract.findById(contractId);
    if (!contract || String(contract.ownerId) !== String(ownerId)) {
      return res.status(403).json({
        success: false,
        message: "Yeh aapka contract nahi hai",
      });
    }
    if (contract.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Contract active nahi hai",
      });
    }
    if (String(contract.driverId) !== String(driverId)) {
      return res.status(400).json({
        success: false,
        message: "Driver match nahi karta",
      });
    }

    const ded = Math.max(0, Number(advanceDeduction) || 0);
    if (ded > amt) {
      return res.status(400).json({
        success: false,
        message: "Advance deduction amount se zyada nahi ho sakta",
      });
    }

    if (advanceId && ded > 0) {
      const adv = await Advance.findById(advanceId);
      if (!adv || String(adv.contractId) !== String(contractId)) {
        return res.status(400).json({
          success: false,
          message: "Advance nahi mila",
        });
      }
      if (!["approved", "partial"].includes(adv.status)) {
        return res.status(400).json({
          success: false,
          message: "Advance approve nahi hai",
        });
      }
      const rem = Number(adv.remaining) || 0;
      if (ded > rem) {
        return res.status(400).json({
          success: false,
          message: "Advance remaining se zyada nahi kaat sakte",
        });
      }
    }

    const netAmount = Math.round((amt - ded) * 100) / 100;

    let payment = await Payment.findOne({
      contractId,
      driverId,
      month: m,
      year: y,
      isDriverRequested: true,
      ownerMarkedPaid: false,
      status: "pending",
    });

    const ownerNote = note != null ? String(note).trim() : "";
    const mergedNote = payment
      ? [payment.note, ownerNote].filter(Boolean).join(" | ")
      : ownerNote;

    if (payment) {
      payment.amount = amt;
      payment.advanceDeduction = ded;
      payment.advanceId = advanceId || null;
      payment.netAmount = netAmount;
      payment.paymentType = pt;
      payment.utrNumber =
        pt === "upi" ? String(utrNumber).trim() : "";
      payment.paymentPhoto = paymentPhoto || "";
      payment.witnessName = witnessName || "";
      payment.note = mergedNote || payment.note || "";
      payment.ownerMarkedPaid = true;
      payment.ownerPaidAt = new Date();
      payment.driverConfirmed = false;
      payment.driverRejected = false;
      payment.status = "pending";
      await payment.save();
    } else {
      payment = await Payment.create({
        contractId,
        ownerId,
        driverId,
        amount: amt,
        advanceDeduction: ded,
        advanceId: advanceId || null,
        netAmount,
        paymentType: pt,
        utrNumber: pt === "upi" ? String(utrNumber).trim() : "",
        paymentPhoto: paymentPhoto || "",
        witnessName: witnessName || "",
        note: mergedNote,
        month: m,
        year: y,
        ownerMarkedPaid: true,
        ownerPaidAt: new Date(),
        driverConfirmed: false,
        driverRejected: false,
        status: "pending",
      });
    }

    await Notification.create({
      userId: driverId,
      title: "Payment Aayi Hai!",
      message: `₹${amt} ki payment mark ki gayi hai. UTR check karke confirm karein.`,
      type: "payment_received",
      link: "/driver/payments",
      isRead: false,
    });

    const populated = await Payment.findById(payment._id)
      .populate("contractId", "salaryPerDay jobId")
      .populate("ownerId", "name phone")
      .populate("driverId", "name phone")
      .populate("advanceId");

    return res.status(201).json({
      success: true,
      payment: populated,
      message: "Payment mark ho gayi! Driver confirm karega.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const confirmPayment = async (req, res) => {
  try {
    const driverId = uidFromReq(req);
    const { paymentId } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: "paymentId zaroori hai",
      });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment nahi mila",
      });
    }
    if (String(payment.driverId) !== String(driverId)) {
      return res.status(403).json({
        success: false,
        message: "Access nahi hai",
      });
    }
    if (!payment.ownerMarkedPaid) {
      return res.status(400).json({
        success: false,
        message: "Owner ne abhi mark nahi kiya",
      });
    }
    if (payment.driverConfirmed || payment.status === "paid") {
      return res.status(400).json({
        success: false,
        message: "Pehle se confirm ho chuka hai",
      });
    }
    if (payment.driverRejected) {
      return res.status(400).json({
        success: false,
        message: "Payment reject ho chuki hai",
      });
    }

    payment.driverConfirmed = true;
    payment.driverConfirmedAt = new Date();
    payment.status = "paid";
    await payment.save();

    const ded = Number(payment.advanceDeduction) || 0;
    if (payment.advanceId && ded > 0) {
      const advance = await Advance.findById(payment.advanceId);
      if (advance) {
        advance.totalRepaid =
          (Number(advance.totalRepaid) || 0) + ded;
        const rem = Number(advance.remaining) || 0;
        advance.remaining = Math.max(0, rem - ded);
        if (advance.remaining <= 0) {
          advance.remaining = 0;
          advance.isCleared = true;
        }
        await advance.save();
      }
    }

    await Notification.create({
      userId: payment.ownerId,
      title: "Driver ne Payment Confirm Ki!",
      message: `₹${payment.amount} payment confirm ho gayi.`,
      type: "payment_received",
      link: "/owner/payments",
      isRead: false,
    });

    return res.json({
      success: true,
      message: "Payment confirm ho gayi!",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const rejectPayment = async (req, res) => {
  try {
    const driverId = uidFromReq(req);
    const { paymentId, reason } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: "paymentId zaroori hai",
      });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment nahi mila",
      });
    }
    if (String(payment.driverId) !== String(driverId)) {
      return res.status(403).json({
        success: false,
        message: "Access nahi hai",
      });
    }
    if (!payment.ownerMarkedPaid) {
      return res.status(400).json({
        success: false,
        message: "Owner ne abhi payment mark nahi ki",
      });
    }
    if (payment.status === "paid") {
      return res.status(400).json({
        success: false,
        message: "Paid payment reject nahi ho sakti",
      });
    }
    if (payment.driverRejected) {
      return res.status(400).json({
        success: false,
        message: "Payment pehle se reject ho chuki hai",
      });
    }

    payment.driverRejected = true;
    payment.driverRejectionReason = reason || "";
    payment.status = "rejected";
    await payment.save();

    await Notification.create({
      userId: payment.ownerId,
      title: "Driver ne Payment Reject Ki!",
      message: `Driver ne ₹${payment.amount} payment reject ki. Reason: ${reason || "Nahi bataya"}`,
      type: "payment_received",
      link: "/owner/payments",
      isRead: false,
    });

    return res.json({
      success: true,
      message: "Payment reject ho gayi",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const getPayments = async (req, res) => {
  try {
    const uid = uidFromReq(req);
    let contract;
    if (req.user.role === "driver") {
      contract = await activeContractDriver(uid);
    } else {
      contract = await activeContractOwner(uid, req.query.contractId);
    }

    if (!contract) {
      return res.status(400).json({
        success: false,
        message: "Koi active contract nahi",
      });
    }

    const payments = await Payment.find({ contractId: contract._id })
      .sort({ createdAt: -1 })
      .populate("contractId", "salaryPerDay jobId")
      .populate("ownerId", "name phone")
      .populate("driverId", "name phone")
      .populate("advanceId");

    return res.json({
      success: true,
      payments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const requestAdvance = async (req, res) => {
  try {
    const driverId = uidFromReq(req);
    const { requestedAmount, reason } = req.body;

    const ramt = Number(requestedAmount);
    if (!ramt || ramt <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount zaroori hai",
      });
    }

    const contract = await activeContractDriver(driverId);
    if (!contract) {
      return res.status(400).json({
        success: false,
        message: "Koi active kaam nahi hai",
      });
    }

    const pending = await Advance.findOne({
      contractId: contract._id,
      status: "pending",
    });
    if (pending) {
      return res.status(400).json({
        success: false,
        message: "Ek advance request pehle se pending hai",
      });
    }

    const advance = await Advance.create({
      contractId: contract._id,
      driverId,
      ownerId: contract.ownerId,
      requestedAmount: ramt,
      reason: reason || "",
      status: "pending",
    });

    await Notification.create({
      userId: contract.ownerId,
      title: "Advance Request Aayi!",
      message: `Driver ne ₹${ramt} advance maanga hai.`,
      type: "payment_received",
      link: "/owner/payments",
      isRead: false,
    });

    return res.status(201).json({
      success: true,
      advance,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const handleAdvance = async (req, res) => {
  try {
    const ownerId = uidFromReq(req);
    const {
      advanceId,
      action,
      approvedAmount,
      paymentType,
      utrNumber,
      paymentPhoto,
      witnessName,
      note,
    } = req.body;

    if (!advanceId) {
      return res.status(400).json({
        success: false,
        message: "advanceId zaroori hai",
      });
    }

    const adv = await Advance.findById(advanceId);
    if (!adv || String(adv.ownerId) !== String(ownerId)) {
      return res.status(403).json({
        success: false,
        message: "Access nahi hai",
      });
    }

    if (adv.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Yeh advance request pehle process ho chuki hai",
      });
    }

    if (action === "reject") {
      adv.status = "rejected";
      adv.remaining = 0;
      await adv.save();

      await Notification.create({
        userId: adv.driverId,
        title: "Advance reject ho gayi",
        message: "Owner ne advance request reject kar di.",
        type: "payment_received",
        link: "/driver/payments",
        isRead: false,
      });

      return res.json({ success: true, advance: adv });
    }

    if (action !== "approve") {
      return res.status(400).json({
        success: false,
        message: "action approve ya reject hona chahiye",
      });
    }

    const appr = Number(approvedAmount);
    if (!appr || appr <= 0) {
      return res.status(400).json({
        success: false,
        message: "approvedAmount zaroori hai",
      });
    }

    const pt = paymentType === "cash" ? "cash" : "upi";
    if (pt === "upi" && (!utrNumber || !String(utrNumber).trim())) {
      return res.status(400).json({
        success: false,
        message: "UPI ke liye UTR zaroori hai",
      });
    }

    adv.approvedAmount = appr;
    adv.remaining = appr;
    adv.totalRepaid = 0;
    adv.isCleared = false;
    adv.paymentType = pt;
    adv.utrNumber = pt === "upi" ? String(utrNumber).trim() : "";
    adv.paymentPhoto = paymentPhoto || "";
    adv.witnessName = witnessName || "";
    adv.note = note || "";

    if (appr < adv.requestedAmount) {
      adv.status = "partial";
    } else {
      adv.status = "approved";
    }

    await adv.save();

    await Notification.create({
      userId: adv.driverId,
      title: "Advance Approved!",
      message: `₹${appr} advance approve ho gayi.`,
      type: "payment_received",
      link: "/driver/payments",
      isRead: false,
    });

    return res.json({
      success: true,
      advance: adv,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const requestPayment = async (req, res) => {
  try {
    const driverId = uidFromReq(req);
    const { month, year, note } = req.body;

    const m = Number(month);
    const y = Number(year);
    if (!m || m < 1 || m > 12 || !y) {
      return res.status(400).json({
        success: false,
        message: "month aur year sahi se bhejein",
      });
    }

    const contract = await Contract.findOne({
      driverId,
      status: "active",
    })
      .sort({ createdAt: -1 })
      .populate("ownerId", "name");

    if (!contract) {
      return res.status(400).json({
        success: false,
        message: "Koi active contract nahi",
      });
    }

    const existingPayment = await Payment.findOne({
      contractId: contract._id,
      driverId,
      month: m,
      year: y,
      status: { $in: ["pending", "paid"] },
    });

    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: "Is mahine ki payment request pehle se hai",
      });
    }

    const monthRecords = await DriverAttendance.find({
      contractId: contract._id,
      month: m,
      year: y,
      driverId,
    })
      .select("salaryForDay")
      .lean();

    const salaryEarned = monthRecords.reduce((sum, r) => sum + (Number(r.salaryForDay) || 0), 0);

    if (salaryEarned === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Is mahine koi salary nahi bani — attendance mark karein",
      });
    }

    const driverProfile = await DriverProfile.findOne({
      driverId,
    });

    const bd = driverProfile?.bankDetails || {};
    const ownerIdRef = contract.ownerId?._id || contract.ownerId;

    const payment = await Payment.create({
      contractId: contract._id,
      ownerId: ownerIdRef,
      driverId,
      amount: salaryEarned,
      netAmount: salaryEarned,
      advanceDeduction: 0,
      month: m,
      year: y,
      status: "pending",
      ownerMarkedPaid: false,
      driverConfirmed: false,
      note: note != null ? String(note).trim() : "",
      driverUpiId: bd.upiId || "",
      driverAccountNumber: bd.accountNumber || "",
      driverIfsc: bd.ifscCode || "",
      driverAccountName: bd.accountName || "",
      driverUpiQrCode: bd.upiQrCode || "",
      isDriverRequested: true,
      driverRequestedAt: new Date(),
    });

    await Notification.create({
      userId: ownerIdRef,
      title: "Payment Request Aayi!",
      message: `${req.user.name || "Driver"} ne ₹${salaryEarned} ki payment request ki hai.`,
      type: "payment_received",
      link: "/owner/payments",
      isRead: false,
    });

    const populated = await Payment.findById(payment._id)
      .populate("contractId", "salaryPerDay jobId")
      .populate("ownerId", "name phone")
      .populate("driverId", "name phone");

    return res.json({
      success: true,
      payment: populated,
      salaryEarned,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const getAdvances = async (req, res) => {
  try {
    const uid = uidFromReq(req);
    let contract;
    if (req.user.role === "driver") {
      contract = await activeContractDriver(uid);
    } else {
      contract = await activeContractOwner(uid, req.query.contractId);
    }

    if (!contract) {
      return res.status(400).json({
        success: false,
        message: "Koi active contract nahi",
      });
    }

    const advances = await Advance.find({ contractId: contract._id })
      .sort({ createdAt: -1 })
      .populate("driverId", "name phone")
      .populate("ownerId", "name phone")
      .populate("contractId", "salaryPerDay jobId");

    return res.json({
      success: true,
      advances,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

module.exports = {
  getPaymentSummary,
  makePayment,
  confirmPayment,
  rejectPayment,
  getPayments,
  requestPayment,
  requestAdvance,
  handleAdvance,
  getAdvances,
};
