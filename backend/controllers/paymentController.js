const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Advance = require("../models/Advance");
const Contract = require("../models/Contract");
const DriverAttendance = require("../models/DriverAttendance");
const Notification = require("../models/Notification");
const DriverProfile = require("../models/DriverProfile");
const TripRecord = require("../models/TripRecord");

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
    const cidQuery = mongoose.Types.ObjectId.isValid(cid)
      ? new mongoose.Types.ObjectId(String(cid))
      : cid;
    const didQuery = mongoose.Types.ObjectId.isValid(driverIdForAttendance)
      ? new mongoose.Types.ObjectId(String(driverIdForAttendance))
      : driverIdForAttendance;

    const driverRecords = await DriverAttendance.find({
      contractId: cidQuery,
      driverId: didQuery,
    })
      .select("month year salaryForDay")
      .lean();

    console.log("Records found:", driverRecords.length);

    const totalSalaryEarned = driverRecords.reduce(
      (sum, r) => sum + (Number(r.salaryForDay) || 0),
      0
    );

    console.log("Total earned:", totalSalaryEarned);

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
    const attendanceBreakdown = Array.from(byMonthYear.values()).sort(
      (a, b) => b.year - a.year || b.month - a.month
    );

    const confirmedPayments = await Payment.find({
      contractId: cid,
      status: "paid",
      driverConfirmed: true,
    });
    const salaryConfirmed = confirmedPayments.filter(
      (p) => !isTripPaymentDoc(p)
    );
    const totalPaid = salaryConfirmed.reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
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

    const netDue = Math.round(
      totalSalaryEarned - Math.round(totalPaid)
    );

    const pendingPayments = await Payment.find({
      contractId: cid,
      ownerMarkedPaid: true,
      driverConfirmed: false,
      driverRejected: false,
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .populate("driverId", "name phone")
      .populate("tripId")
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
      .populate("tripId")
      .lean();

    const dp = await DriverProfile.findOne({
      driverId: driverIdForAttendance,
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
      paymentId,
      contractId,
      driverId,
      amount,
      paymentType,
      utrNumber,
      paymentPhoto,
      witnessName,
      note,
      advanceDeduction: advanceDeductionBody,
      advanceId,
      month,
      year,
    } = req.body;

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

      await Notification.create({
        userId: tripPay.driverId,
        title: "Trip Payment Aayi Hai!",
        message: `₹${tripAmt} trip payment mark ki gayi hai. UTR check karke confirm karein.`,
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
      .populate("tripId");

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

    const attendanceRecords = await DriverAttendance.find({
      contractId: contract._id,
      driverId: driverIdForAttendance,
    })
      .select("salaryForDay")
      .lean();

    const totalSalaryEarned = attendanceRecords.reduce(
      (sum, r) => sum + (Number(r.salaryForDay) || 0),
      0
    );

    const confirmedPayments = await Payment.find({
      contractId: contract._id,
      status: "paid",
      driverConfirmed: true,
    });

    const totalPaid = confirmedPayments
      .filter((p) => !isTripPaymentDoc(p))
      .reduce((sum, p) => sum + (Number(p.netAmount) || 0), 0);

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

    const driverProfile = await DriverProfile.findOne({
      driverId,
    });

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

    await Notification.create({
      userId: ownerIdRef,
      title: "Payment Request Aayi!",
      message: `${req.user.name || "Driver"} ne ₹${requestAmt} ki payment request ki hai.`,
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
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
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

    const contract = await Contract.findById(trip.contractId);
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
    if (!amt || amt <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount sahi nahi hai",
      });
    }

    const driverProfile = await DriverProfile.findOne({
      driverId,
    });
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

    await Notification.create({
      userId: ownerIdRef,
      title: "Trip Payment Request!",
      message: `Driver ne trip payment request ki hai. Amount: ₹${amt}`,
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
  createTripPaymentRequest,
  requestAdvance,
  handleAdvance,
  getAdvances,
};
