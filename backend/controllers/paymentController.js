const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Advance = require("../models/Advance");
const Contract = require("../models/Contract");
const DriverAttendance = require("../models/DriverAttendance");
const Notification = require("../models/Notification");
const DriverProfile = require("../models/DriverProfile");
const TripRecord = require("../models/TripRecord");

// Constants
const MAX_AMOUNT = 10000000; // 1 crore (sanity limit)
const MAX_UTR_LENGTH = 100;
const MAX_NOTE_LENGTH = 1000;
const MAX_WITNESS_LENGTH = 200;
const MAX_REASON_LENGTH = 1000;
const MIN_MONTH = 1;
const MAX_MONTH = 12;
const MIN_YEAR = 2020;
const MAX_YEAR = 2100;

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

const isValidAmount = (amt) => {
  return Number.isFinite(amt) && amt > 0 && amt <= MAX_AMOUNT;
};

/**
 * Calculate pro-rated salary for transport drivers.
 * First month: pro-rated by days from join date.
 * Subsequent months: full monthly salary.
 * Per day = monthlySalary / 30 (industry standard).
 */
const calcTransportSalary = (monthlySalary, contractStart) => {
  if (!monthlySalary || monthlySalary <= 0) return 0;
  if (!contractStart) return 0;

  const start = new Date(contractStart);
  const now = new Date();

  if (isNaN(start.getTime())) return 0;
  if (start > now) return 0;

  const perDay = Number(monthlySalary) / 30;
  let total = 0;

  // Cursor at contract start date
  let cursorYear = start.getFullYear();
  let cursorMonth = start.getMonth();
  let cursorDay = start.getDate();

  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  const nowDay = now.getDate();

  while (
    cursorYear < nowYear ||
    (cursorYear === nowYear && cursorMonth <= nowMonth)
  ) {
    // Last day of this month
    const lastDayOfMonth = new Date(
      cursorYear,
      cursorMonth + 1,
      0
    ).getDate();

    const isStartMonth =
      cursorYear === start.getFullYear() &&
      cursorMonth === start.getMonth();

    const isCurrentMonth =
      cursorYear === nowYear &&
      cursorMonth === nowMonth;

    if (isStartMonth && isCurrentMonth) {
      // Same month - joined and checking now
      const daysWorked = nowDay - cursorDay + 1;
      total += Math.round(perDay * Math.max(0, daysWorked));
      break;
    } else if (isStartMonth) {
      // First month, partial (join to month end)
      const daysWorked = lastDayOfMonth - cursorDay + 1;
      total += Math.round(perDay * Math.max(0, daysWorked));
    } else if (isCurrentMonth) {
      // Current month, partial (1st to today)
      const daysWorked = nowDay;
      total += Math.round(perDay * Math.max(0, daysWorked));
      break;
    } else {
      // Full month in between
      total += Number(monthlySalary);
    }

    // Move cursor to 1st of next month
    cursorMonth += 1;
    if (cursorMonth > 11) {
      cursorMonth = 0;
      cursorYear += 1;
    }
    cursorDay = 1;
  }

  return total;
};

const uidFromReq = (req) => req.user._id || req.user.id;

/** Trip settlement — not counted in salary totalPaid / netDue */
const isTripPaymentDoc = (p) =>
  p.paymentType === "trip" ||
  p.requestKind === "trip" ||
  (p.tripId != null && p.tripId !== "");

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

/** Any contract owned by owner (for payment history / trip totals). */
const contractOwnedByOwner = async (ownerId, contractId) => {
  if (!contractId) return null;
  const c = await Contract.findById(contractId);
  if (!c || String(c.ownerId) !== String(ownerId)) return null;
  return c;
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
    const isTransport = contract.vehicleCategory === 'transport';

    // PARALLEL - all 5 queries at once (5x faster!)
    const [
      driverRecords,
      confirmedPayments,
      activeAdvances,
      pendingPayments,
      pendingRequests,
      dp,
      _populatedContract,
    ] = await Promise.all([
      // Attendance records (only if non-transport)
      isTransport
        ? Promise.resolve([])
        : DriverAttendance.find({
            contractId: cid,
            driverId: driverIdForAttendance,
          })
            .select("month year salaryForDay")
            .lean(),

      // Confirmed payments
      Payment.find({
        contractId: cid,
        status: "paid",
        driverConfirmed: true,
      }).lean(),

      // Active advances
      Advance.find({
        contractId: cid,
        status: { $in: ["approved", "partial"] },
        isCleared: false,
      }).lean(),

      // Pending payments (owner marked, not confirmed)
      Payment.find({
        contractId: cid,
        ownerMarkedPaid: true,
        driverConfirmed: false,
        driverRejected: false,
        status: "pending",
      })
        .sort({ createdAt: -1 })
        .populate("driverId", "name phone")
        .populate("tripId")
        .lean(),

      // Pending requests (driver requested)
      Payment.find({
        contractId: cid,
        status: "pending",
        ownerMarkedPaid: false,
        isDriverRequested: true,
      })
        .sort({ createdAt: -1 })
        .populate("driverId", "name phone")
        .populate("tripId")
        .lean(),

      // Driver bank details
      DriverProfile.findOne({ driverId: driverIdForAttendance })
        .select("bankDetails")
        .lean(),

      // Populate contract
      contract.populate([
        {
          path: "jobId",
          select:
            "title vehicleType salaryType vehicleCategory salaryPerDay salaryPerMonth salaryPerHour dailyBhatta hasHourlyBonus",
        },
        { path: "driverId", select: "name phone" },
      ]),
    ]);

    // Calculate salary earned
    let totalSalaryEarned = 0;
    let attendanceBreakdown = [];

    if (isTransport) {
      const contractStart =
        contract.workStartDate ||
        contract.startDate ||
        contract.createdAt;
      totalSalaryEarned = calcTransportSalary(
        Number(contract.salaryPerMonth) || 0,
        contractStart
      );
    } else {
      totalSalaryEarned = driverRecords.reduce(
        (sum, r) => sum + (Number(r.salaryForDay) || 0),
        0
      );

      // Build month-year breakdown
      const byMonthYear = new Map();
      for (const r of driverRecords) {
        const key = `${r.year}-${r.month}`;
        const prev = byMonthYear.get(key) || {
          month: r.month,
          year: r.year,
          totalSalaryEarned: 0,
        };
        prev.totalSalaryEarned += Number(r.salaryForDay) || 0;
        byMonthYear.set(key, prev);
      }
      attendanceBreakdown = Array.from(byMonthYear.values()).sort(
        (a, b) => b.year - a.year || b.month - a.month
      );
    }

    // Single-pass aggregation for payments
    let totalPaid = 0;
    for (const p of confirmedPayments) {
      if (!isTripPaymentDoc(p)) {
        totalPaid += Number(p.amount) || 0;
      }
    }

    // Single-pass aggregation for advances
    let totalAdvance = 0;
    let totalAdvanceRepaid = 0;
    let totalAdvanceRemaining = 0;
    for (const a of activeAdvances) {
      totalAdvance += Number(a.approvedAmount) || 0;
      totalAdvanceRepaid += Number(a.totalRepaid) || 0;
      totalAdvanceRemaining += Number(a.remaining) || 0;
    }

    const netDue = Math.round(totalSalaryEarned - Math.round(totalPaid));

    return res.json({
      success: true,
      summary: {
        totalSalaryEarned,
        totalPaid,
        totalAdvance,
        totalAdvanceRepaid,
        totalAdvanceRemaining,
        netDue,
        isTransport,
        contract: contract.toObject(),
        attendance: attendanceBreakdown,
        pendingRequests,
        pendingPayments,
        driverBankDetails: dp?.bankDetails || null,
      },
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const makePayment = async (req, res) => {
  try {
    const ownerId = uidFromReq(req);
    const {
      paymentId,
      contractId,
      driverId,
      amount,
      paymentType,
      utrNumber,
      paymentPhoto: paymentPhotoBody,
      witnessName,
      note,
      advanceDeduction: advanceDeductionBody,
      advanceId,
      month,
      year,
    } = req.body;

    let paymentPhoto =
      paymentPhotoBody != null &&
      String(paymentPhotoBody).trim() !== ""
        ? String(paymentPhotoBody).trim()
        : "";
    if (req.file) {
      const u =
        req.file.path || req.file.secure_url || req.file.url || "";
      if (u) paymentPhoto = u;
    }

    const pm = paymentType === "cash" ? "cash" : "upi";

    if (paymentId) {
      if (!mongoose.Types.ObjectId.isValid(String(paymentId))) {
        return res.status(400).json({
          success: false,
          message: "paymentId galat hai",
        });
      }
      const tripPay = await Payment.findById(paymentId);
      if (!tripPay) {
        return res.status(404).json({
          success: false,
          message: "Payment nahi mila",
        });
      }
      if (String(tripPay.ownerId) !== String(ownerId)) {
        return res.status(403).json({
          success: false,
          message: "Access nahi hai",
        });
      }
      if (!isTripPaymentDoc(tripPay)) {
        return res.status(400).json({
          success: false,
          message: "Salary payment ke liye month/year wala form use karein",
        });
      }
      if (tripPay.ownerMarkedPaid) {
        return res.status(400).json({
          success: false,
          message: "Pehle se mark ho chuka hai",
        });
      }
      const tripAmt = Math.round(Number(amount));
      if (!tripAmt || tripAmt <= 0) {
        return res.status(400).json({
          success: false,
          message: "Amount likhein",
        });
      }
      if (pm === "upi" && (!utrNumber || !String(utrNumber).trim())) {
        return res.status(400).json({
          success: false,
          message: "UPI ke liye UTR zaroori hai",
        });
      }

      const tripContract = await Contract.findById(tripPay.contractId);
      if (
        !tripContract ||
        String(tripContract.ownerId) !== String(ownerId)
      ) {
        return res.status(403).json({
          success: false,
          message: "Yeh aapka contract nahi hai",
        });
      }
      if (tripContract.status !== "active") {
        return res.status(400).json({
          success: false,
          message: "Contract active nahi hai",
        });
      }

      const ownerNoteTrip =
        note != null ? String(note).trim() : "";
      const mergedNoteTrip = [tripPay.note, ownerNoteTrip]
        .filter(Boolean)
        .join(" | ");

      tripPay.amount = tripAmt;
      tripPay.netAmount = tripAmt;
      tripPay.advanceDeduction = 0;
      tripPay.advanceId = null;
      tripPay.payoutMethod = pm;
      tripPay.paymentType = "trip";
      tripPay.requestKind = "trip";
      tripPay.utrNumber =
        pm === "upi" ? String(utrNumber).trim() : "";
      tripPay.paymentPhoto = paymentPhoto || "";
      tripPay.witnessName = witnessName || "";
      tripPay.note = mergedNoteTrip || tripPay.note || "";
      tripPay.ownerMarkedPaid = true;
      tripPay.ownerPaidAt = new Date();
      tripPay.driverConfirmed = false;
      tripPay.driverRejected = false;
      tripPay.status = "pending";
      await tripPay.save();

      createNotificationSafe({
        userId: tripPay.driverId,
        title: "Trip Payment Received!",
        message: `₹${tripAmt} trip payment was marked as paid. Please verify the UTR and confirm.`,
        type: "payment_received",
        link: "/driver/payments",
        isRead: false,
      });

      const populatedTrip = await Payment.findById(tripPay._id)
        .populate("contractId", "salaryPerDay jobId")
        .populate("ownerId", "name phone")
        .populate("driverId", "name phone")
        .populate("advanceId")
        .populate("tripId");

      return res.status(201).json({
        success: true,
        payment: populatedTrip,
        message: "Trip payment mark ho gayi! Driver confirm karega.",
      });
    }

    const amt = Math.round(Number(amount));
    if (!contractId || !driverId || !amt || amt <= 0) {
      return res.status(400).json({
        success: false,
        message: "contractId, driverId aur amount zaroori hain",
      });
    }

    // ObjectId validations
    if (!isValidObjectId(contractId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contract ID",
      });
    }
    if (!isValidObjectId(driverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid driver ID",
      });
    }

    // Amount sanity check
    if (amt > MAX_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: "Amount bahut zyada hai",
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

    if (pm === "upi" && (!utrNumber || !String(utrNumber).trim())) {
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

    let ded = Math.round(
      Math.max(0, Number(advanceDeductionBody) || 0)
    );
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
      const rem = Math.round(Number(adv.remaining) || 0);
      if (ded > rem) {
        return res.status(400).json({
          success: false,
          message: "Advance remaining se zyada nahi kaat sakte",
        });
      }
      ded = Math.round(Math.min(rem, amt, ded));
    }

    const advanceDeduction = Math.round(ded);
    const netAmount = Math.round(amt - advanceDeduction);

    let payment = await Payment.findOne({
      contractId,
      driverId,
      month: m,
      year: y,
      isDriverRequested: true,
      ownerMarkedPaid: false,
      status: "pending",
      $nor: [{ paymentType: "trip" }, { requestKind: "trip" }],
    });

    const ownerNote = note != null ? String(note).trim() : "";
    const mergedNote = payment
      ? [payment.note, ownerNote].filter(Boolean).join(" | ")
      : ownerNote;

    if (payment) {
      payment.amount = amt;
      payment.advanceDeduction = advanceDeduction;
      payment.advanceId = advanceId || null;
      payment.netAmount = netAmount;
      payment.payoutMethod = pm;
      payment.paymentType = "salary";
      payment.requestKind = "salary";
      payment.utrNumber =
        pm === "upi" ? String(utrNumber).trim() : "";
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
        advanceDeduction,
        advanceId: advanceId || null,
        netAmount,
        paymentType: "salary",
        requestKind: "salary",
        payoutMethod: pm,
        utrNumber: pm === "upi" ? String(utrNumber).trim() : "",
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

    createNotificationSafe({
      userId: driverId,
      title: "Payment Received!",
      message: `₹${amt} payment was marked as paid. Please verify the UTR and confirm.`,
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
    return sendServerError(res);
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

    if (!isValidObjectId(paymentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID",
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

    if (isTripPaymentDoc(payment)) {
      payment.paymentType = "trip";
      payment.requestKind = "trip";
    } else if (
      payment.paymentType === "upi" ||
      payment.paymentType === "cash"
    ) {
      payment.payoutMethod = payment.paymentType;
      payment.paymentType = "salary";
      payment.requestKind = "salary";
    }

    payment.driverConfirmed = true;
    payment.driverConfirmedAt = new Date();
    payment.status = "paid";
    await payment.save();

    const advanceDeduction = Math.round(
      Number(payment.advanceDeduction) || 0
    );
    if (payment.advanceId && advanceDeduction > 0) {
      const advance = await Advance.findById(payment.advanceId);
      if (advance) {
        const totalRepaid = Math.round(
          (Number(advance.totalRepaid) || 0) + advanceDeduction
        );
        const newRemaining = Math.round(
          (Number(advance.remaining) || 0) - advanceDeduction
        );
        await Advance.findByIdAndUpdate(advance._id, {
          totalRepaid,
          remaining: Math.max(0, newRemaining),
          isCleared: newRemaining <= 0,
        });
      }
    }

    createNotificationSafe({
      userId: payment.ownerId,
      title: "Payment Confirmed",
      message: `The driver confirmed the ₹${payment.amount} payment.`,
      type: "payment_received",
      link: "/owner/payments",
      isRead: false,
    });

    return res.json({
      success: true,
      message: "Payment confirm ho gayi!",
    });
  } catch (error) {
    return sendServerError(res);
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

    if (!isValidObjectId(paymentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID",
      });
    }

    const reasonTrim = String(reason || "").slice(0, MAX_REASON_LENGTH);

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
    payment.driverRejectionReason = reasonTrim;
    payment.status = "rejected";
    await payment.save();

    createNotificationSafe({
      userId: payment.ownerId,
      title: "Payment Rejected",
      message: `The driver rejected the ₹${payment.amount} payment. Reason: ${reasonTrim || "Not provided"}`,
      type: "payment_received",
      link: "/owner/payments",
      isRead: false,
    });

    return res.json({
      success: true,
      message: "Payment reject ho gayi",
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getPayments = async (req, res) => {
  try {
    const uid = uidFromReq(req);
    let contract;
    if (req.user.role === "driver") {
      contract = await activeContractDriver(uid);
    } else if (req.query.contractId) {
      contract = await contractOwnedByOwner(uid, req.query.contractId);
    } else {
      contract = await activeContractOwner(uid, req.query.contractId);
    }

    if (!contract) {
      return res.status(400).json({
        success: false,
        message: req.user.role === "owner" && req.query.contractId
          ? "Contract nahi mila"
          : "Koi active contract nahi",
      });
    }

    const payments = await Payment.find({ contractId: contract._id })
      .sort({ createdAt: -1 })
      .populate("contractId", "salaryPerDay jobId")
      .populate("ownerId", "name phone")
      .populate("driverId", "name phone")
      .populate("advanceId")
      .populate("tripId")
      .lean();

    return res.json({
      success: true,
      payments,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const requestAdvance = async (req, res) => {
  try {
    const driverId = uidFromReq(req);
    const { requestedAmount, reason } = req.body;

    const ramt = Number(requestedAmount);
    if (!isValidAmount(ramt)) {
      return res.status(400).json({
        success: false,
        message: "Amount valid honi chahiye",
      });
    }

    const reasonTrim = String(reason || "").slice(0, MAX_REASON_LENGTH);

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
      reason: reasonTrim,
      status: "pending",
    });

    createNotificationSafe({
      userId: contract.ownerId,
      title: "Advance Requested",
      message: `The driver requested an advance of ₹${ramt}.`,
      type: "payment_received",
      link: "/owner/payments",
      isRead: false,
    });

    return res.status(201).json({
      success: true,
      advance,
    });
  } catch (error) {
    return sendServerError(res);
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

    if (!isValidObjectId(advanceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid advance ID",
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

      createNotificationSafe({
        userId: adv.driverId,
        title: "Advance Rejected",
        message: "The owner rejected your advance request.",
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
    if (!isValidAmount(appr)) {
      return res.status(400).json({
        success: false,
        message: "approvedAmount valid honi chahiye",
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

    createNotificationSafe({
      userId: adv.driverId,
      title: "Advance Approved!",
      message: `Your advance of ₹${appr} was approved.`,
      type: "payment_received",
      link: "/driver/payments",
      isRead: false,
    });

    return res.json({
      success: true,
      advance: adv,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const requestPayment = async (req, res) => {
  try {
    const driverId = uidFromReq(req);
    const { month, year, note, amount: amountBody } = req.body;

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

    const driverIdForAttendance =
      contract.driverId?._id || contract.driverId;
    const isTransport = contract.vehicleCategory === 'transport';

    // PARALLEL - attendance + payments + driver profile (3x faster)
    const [attendanceRecords, confirmedPayments, driverProfile] = await Promise.all([
      isTransport
        ? Promise.resolve([])
        : DriverAttendance.find({
            contractId: contract._id,
            driverId: driverIdForAttendance,
          })
            .select("salaryForDay")
            .lean(),
      Payment.find({
        contractId: contract._id,
        status: "paid",
        driverConfirmed: true,
      }).lean(),
      DriverProfile.findOne({ driverId }).lean(),
    ]);

    let totalSalaryEarned = 0;
    if (isTransport) {
      const contractStart =
        contract.workStartDate ||
        contract.startDate ||
        contract.createdAt;
      totalSalaryEarned = calcTransportSalary(
        Number(contract.salaryPerMonth) || 0,
        contractStart
      );
    } else {
      totalSalaryEarned = attendanceRecords.reduce(
        (sum, r) => sum + (Number(r.salaryForDay) || 0),
        0
      );
    }

    // Single-pass aggregation
    let totalPaid = 0;
    for (const p of confirmedPayments) {
      if (!isTripPaymentDoc(p)) {
        totalPaid += Number(p.netAmount) || 0;
      }
    }

    const netDue = totalSalaryEarned - totalPaid;

    if (netDue <= 0) {
      return res.status(400).json({
        success: false,
        message: "Koi payment baaki nahi hai",
      });
    }

    let requestAmt = Number(amountBody);
    if (!Number.isFinite(requestAmt) || requestAmt <= 0) {
      requestAmt = netDue;
    }
    if (requestAmt > netDue) {
      return res.status(400).json({
        success: false,
        message: "Amount net due se zyada nahi ho sakta",
      });
    }
    if (requestAmt > MAX_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: "Amount bahut zyada hai",
      });
    }

    const bd = driverProfile?.bankDetails || {};
    const ownerIdRef = contract.ownerId?._id || contract.ownerId;

    const payment = await Payment.create({
      contractId: contract._id,
      ownerId: ownerIdRef,
      driverId,
      amount: requestAmt,
      netAmount: requestAmt,
      advanceDeduction: 0,
      paymentType: "salary",
      requestKind: "salary",
      payoutMethod: "upi",
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

    createNotificationSafe({
      userId: ownerIdRef,
      title: "Payment Requested",
      message: `${req.user.name || "Driver"} requested a payment of ₹${requestAmt}.`,
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
      netDue,
      requestAmount: requestAmt,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const createTripPaymentRequest = async (req, res) => {
  try {
    const driverId = uidFromReq(req);
    const { tripId, amount: amountBody } = req.body;

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "tripId zaroori hai",
      });
    }

    if (!isValidObjectId(tripId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid trip ID",
      });
    }

    const trip = await TripRecord.findById(tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip nahi mili",
      });
    }

    if (String(trip.driverId) !== String(driverId)) {
      return res.status(403).json({
        success: false,
        message: "Access nahi hai",
      });
    }

    if (trip.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Sirf approved trip ke liye payment request",
      });
    }

    if (trip.paymentRequested) {
      return res.status(400).json({
        success: false,
        message: "Is trip ka payment already request ho chuka hai",
      });
    }

    const existingPay = await Payment.findOne({
      tripId: trip._id,
      status: { $in: ["pending", "paid"] },
    });
    if (existingPay) {
      return res.status(400).json({
        success: false,
        message: "Is trip ka payment already request ho chuka hai",
      });
    }

    // PARALLEL - contract + driver profile (2x faster)
    const [contract, driverProfile] = await Promise.all([
      Contract.findById(trip.contractId).lean(),
      DriverProfile.findOne({ driverId }).lean(),
    ]);

    if (!contract) {
      return res.status(400).json({
        success: false,
        message: "Contract nahi mila",
      });
    }

    const amt =
      Number(amountBody) ||
      Number(trip.approvedAmount) ||
      Number(trip.approvedExpenses) ||
      0;
    if (!isValidAmount(amt)) {
      return res.status(400).json({
        success: false,
        message: "Amount sahi nahi hai",
      });
    }

    const bd = driverProfile?.bankDetails || {};
    const ownerIdRef = contract.ownerId?._id || contract.ownerId;
    const now = new Date();

    const payment = await Payment.create({
      contractId: trip.contractId,
      ownerId: ownerIdRef,
      driverId,
      amount: amt,
      netAmount: amt,
      advanceDeduction: 0,
      paymentType: "trip",
      requestKind: "trip",
      payoutMethod: "upi",
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      status: "pending",
      ownerMarkedPaid: false,
      driverConfirmed: false,
      note: "trip_payment",
      tripId: trip._id,
      driverUpiId: bd.upiId || "",
      driverAccountNumber: bd.accountNumber || "",
      driverIfsc: bd.ifscCode || "",
      driverAccountName: bd.accountName || "",
      driverUpiQrCode: bd.upiQrCode || "",
      isDriverRequested: true,
      driverRequestedAt: now,
    });

    trip.paymentRequested = true;
    trip.paymentRequestedAt = now;
    await trip.save();

    createNotificationSafe({
      userId: ownerIdRef,
      title: "Trip Payment Requested",
      message: `The driver requested trip payment. Amount: ₹${amt}`,
      type: "payment_request",
      link: "/owner/payments",
      isRead: false,
    });

    const populated = await Payment.findById(payment._id)
      .populate("contractId", "salaryPerDay jobId")
      .populate("ownerId", "name phone")
      .populate("driverId", "name phone")
      .populate("tripId");

    return res.json({
      success: true,
      message: "Trip payment request bhej di!",
      payment: populated,
    });
  } catch (error) {
    return sendServerError(res);
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
      .populate("contractId", "salaryPerDay jobId")
      .lean();

    return res.json({
      success: true,
      advances,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getOwnerPaymentsSummary = async (req, res) => {
  try {
    const ownerId = req.user._id || req.user.id

    // Get ALL payments for this owner in ONE query
    const payments = await Payment.find({
      ownerId,
    })
      .select(
        'amount month year status driverConfirmed isDriverRequested ownerMarkedPaid contractId createdAt paymentType requestKind tripId'
      )
      .sort({ createdAt: -1 })
      .lean()

    return res.json({
      success: true,
      payments,
    })
  } catch (error) {
    return sendServerError(res);
  }
}

module.exports = {
  getPaymentSummary,
  makePayment,
  confirmPayment,
  rejectPayment,
  getPayments,
  requestPayment,
  createTripPaymentRequest,
  requestAdvance,
  handleAdvance,
  getAdvances,
  getOwnerPaymentsSummary,
};
