const mongoose = require("mongoose");
const DriverAttendance = require("../models/DriverAttendance");
const OwnerAttendance = require("../models/OwnerAttendance");
const Contract = require("../models/Contract");
const Payment = require("../models/Payment");

// Constants
const ALLOWED_STATUSES = ["present", "absent", "half_day"];
const MAX_HOURS = 24;
const MAX_NOTE_LENGTH = 500;

// Helpers
const sendServerError = (res) => {
  return res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production" ? "Server error" : undefined,
  });
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
};

// Get user ID safely (works with both .lean() and regular Mongoose docs)
const uidFromReq = (req) => req.user._id || req.user.id;

const validateAttendanceInput = (date, status, hours) => {
  // Date validation
  const recordDate = new Date(date);
  if (isNaN(recordDate.getTime())) {
    return { valid: false, error: "Date sahi nahi hai" };
  }

  // Not future date
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (recordDate > today) {
    return { valid: false, error: "Future date nahi chal sakti" };
  }

  // Status enum validation
  if (!ALLOWED_STATUSES.includes(status)) {
    return { valid: false, error: "Status invalid hai" };
  }

  // Hours validation
  const h = Number(hours) || 0;
  if (h < 0 || h > MAX_HOURS) {
    return { valid: false, error: "Hours 0 se 24 ke beech honi chahiye" };
  }

  return { valid: true };
};

const calculateDaySalary = (contract, status, hours) => {
  const {
    salaryType,
    vehicleCategory,
    salaryPerDay,
    salaryPerMonth,
    salaryPerHour,
    dailyBhatta,
    hasHourlyBonus,
  } = contract;

  if (vehicleCategory === "transport") {
    const dailyBase = (Number(salaryPerMonth) || 0) / 30;
    return status === "present" ? dailyBase : status === "half_day" ? dailyBase / 2 : 0;
  }

  let salary = 0;
  const daysBase = salaryPerMonth ? Number(salaryPerMonth) / 30 : Number(salaryPerDay) || 0;

  if (status === "present") {
    if (salaryType === "hourly") {
      salary =
        (Number(hours) || 0) * (Number(salaryPerHour) || 0);
    } else {
      salary = daysBase;
    }
    salary += Number(dailyBhatta) || 0;
  } else if (status === "half_day") {
    if (salaryType === "hourly") {
      salary =
        (Number(hours) || 0) * (Number(salaryPerHour) || 0);
    } else {
      salary = daysBase / 2;
    }
    salary += (Number(dailyBhatta) || 0) / 2;
  }

  if (
    hasHourlyBonus &&
    salaryType !== "hourly" &&
    status !== "absent"
  ) {
    salary +=
      (Number(hours) || 0) * (Number(salaryPerHour) || 0);
  }

  return Math.round(salary);
};

const driverAddRecord = async (req, res) => {
  try {
    const { date, status, note } = req.body;
    const hoursWorked = Number(req.body.hoursWorked) || 0;

    if (!date || !status) {
      return res.status(400).json({
        success: false,
        message: "Date aur status required hai",
      });
    }

    // Validate input
    const validation = validateAttendanceInput(date, status, hoursWorked);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const noteTrim = String(note || "").slice(0, MAX_NOTE_LENGTH);

    const userId = uidFromReq(req);
    const contract = await Contract.findOne({
      driverId: userId,
      status: "active",
    });

    if (!contract) {
      return res.status(400).json({
        success: false,
        message: "Koi active contract nahi",
      });
    }

    if (contract.vehicleCategory === 'transport') {
      return res.status(400).json({
        success: false,
        message:
          'Transport driver ke liye daily attendance nahi hoti. Sirf trip records bharein.',
        code: 'TRANSPORT_NO_ATTENDANCE',
      })
    }

    // Block attendance if work not started yet
    if (!contract.workStartDate) {
      return res.status(400).json({
        success: false,
        message: 'Pehle "Kaam Shuru" button click karein',
        code: 'NEEDS_WORK_START',
      })
    }

    // Don't allow attendance before work start date
    const recordDateCheck = new Date(date)
    recordDateCheck.setHours(0, 0, 0, 0)
    const workStartCheck = new Date(contract.workStartDate)
    workStartCheck.setHours(0, 0, 0, 0)
    if (recordDateCheck < workStartCheck) {
      return res.status(400).json({
        success: false,
        message: 'Kaam shuru date se pehle attendance nahi laga sakte',
      })
    }

    const recordDate = new Date(date);
    recordDate.setHours(0, 0, 0, 0);

    const existing = await DriverAttendance.findOne({
      contractId: contract._id,
      driverId: userId,
      date: {
        $gte: new Date(
          recordDate.getFullYear(),
          recordDate.getMonth(),
          recordDate.getDate()
        ),
        $lt: new Date(
          recordDate.getFullYear(),
          recordDate.getMonth(),
          recordDate.getDate() + 1
        ),
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Is din ka record pehle se hai",
      });
    }

    const salaryForDay = calculateDaySalary(
      contract,
      status,
      hoursWorked
    );

    const record = await DriverAttendance.create({
      contractId: contract._id,
      driverId: userId,
      ownerId: contract.ownerId,
      date: recordDate,
      month: recordDate.getMonth() + 1,
      year: recordDate.getFullYear(),
      status,
      hoursWorked,
      note: noteTrim,
      salaryForDay,
    });

    return res.json({
      success: true,
      record,
      message: "Record save ho gaya!",
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const driverGetRecords = async (req, res) => {
  try {
    const { month, year } = req.query;
    const userId = uidFromReq(req);

    const contract = await Contract.findOne({
      driverId: userId,
      status: "active",
    }).lean();

    if (!contract) {
      return res.json({
        success: true,
        records: [],
        summary: null,
        contract: null,
      });
    }

    const query = {
      contractId: contract._id,
      driverId: userId,
    };

    if (month) query.month = Number(month);
    if (year) query.year = Number(year);

    const records = await DriverAttendance.find(query)
      .sort({ date: -1 })
      .lean();

    // Single-pass summary (O(n))
    const summary = {
      presentDays: 0,
      absentDays: 0,
      halfDays: 0,
      totalHours: 0,
      grossTotal: 0,
    };

    for (const r of records) {
      if (r.status === "present") summary.presentDays += 1;
      else if (r.status === "absent") summary.absentDays += 1;
      else if (r.status === "half_day") summary.halfDays += 1;

      summary.totalHours += r.hoursWorked || 0;
      summary.grossTotal += r.salaryForDay || 0;
    }

    return res.json({
      success: true,
      records,
      summary,
      contract,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const driverDeleteRecord = async (req, res) => {
  try {
    const recordId = req.params.id;
    const userId = uidFromReq(req);

    if (!isValidObjectId(recordId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid record ID",
      });
    }

    const record = await DriverAttendance.findOne({
      _id: recordId,
      driverId: userId,
    }).lean();

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record nahi mila",
      });
    }

    // PARALLEL - get payments + all records (2x faster)
    const [confirmedPayments, allRecords] = await Promise.all([
      Payment.find({
        contractId: record.contractId,
        driverId: userId,
        status: "paid",
        driverConfirmed: true,
        $nor: [{ paymentType: "trip" }, { requestKind: "trip" }],
      })
        .select("amount")
        .lean(),
      DriverAttendance.find({
        contractId: record.contractId,
        driverId: userId,
      })
        .select("_id salaryForDay date")
        .sort({ date: 1 })
        .lean(),
    ]);

    const totalConfirmedAmount = confirmedPayments.reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );

    if (totalConfirmedAmount > 0) {
      let remaining = totalConfirmedAmount;
      const lockedIds = new Set();

      for (const r of allRecords) {
        if (remaining <= 0) break;
        const salary = Number(r.salaryForDay) || 0;
        if (salary > 0) {
          remaining -= salary;
          lockedIds.add(String(r._id));
        }
      }

      if (lockedIds.has(String(record._id))) {
        return res.status(400).json({
          success: false,
          message:
            "Is din ki salary payment mil chuki hai — ye record delete nahi ho sakta",
        });
      }
    }

    await DriverAttendance.findOneAndDelete({
      _id: recordId,
      driverId: userId,
    });

    return res.json({
      success: true,
      message: "Record delete ho gaya",
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const ownerAddRecord = async (req, res) => {
  try {
    const { contractId, date, status, hoursWorked, note } = req.body;

    if (!contractId || !date || !status) {
      return res.status(400).json({
        success: false,
        message: "Sab fields required hain",
      });
    }

    if (!isValidObjectId(contractId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contract ID",
      });
    }

    // Validate input
    const validation = validateAttendanceInput(date, status, hoursWorked);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const noteTrim = String(note || "").slice(0, MAX_NOTE_LENGTH);

    const ownerId = uidFromReq(req);
    const contract = await Contract.findOne({
      _id: contractId,
      ownerId: ownerId,
      status: "active",
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract nahi mila",
      });
    }

    const recordDate = new Date(date);
    recordDate.setHours(0, 0, 0, 0);

    const existing = await OwnerAttendance.findOne({
      contractId,
      driverId: contract.driverId,
      date: recordDate,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Is din ka record pehle se hai",
      });
    }

    const salaryForDay = calculateDaySalary(
      contract,
      status,
      Number(hoursWorked) || 0
    );

    const record = await OwnerAttendance.create({
      contractId,
      driverId: contract.driverId,
      ownerId: ownerId,
      date: recordDate,
      month: recordDate.getMonth() + 1,
      year: recordDate.getFullYear(),
      status,
      hoursWorked: Number(hoursWorked) || 0,
      note: noteTrim,
      salaryForDay,
    });

    return res.json({
      success: true,
      record,
      message: "Record save ho gaya!",
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const ownerGetRecords = async (req, res) => {
  try {
    const { contractId, month, year } = req.query;

    if (!contractId) {
      return res.status(400).json({
        success: false,
        message: "contractId required",
      });
    }

    if (!isValidObjectId(contractId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contract ID",
      });
    }

    const ownerId = uidFromReq(req);
    const contract = await Contract.findOne({
      _id: contractId,
      ownerId: ownerId,
    })
      .populate("driverId", "name phone")
      .lean();

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract nahi mila",
      });
    }

    const query = {
      contractId,
      ownerId: ownerId,
    };

    if (month) query.month = Number(month);
    if (year) query.year = Number(year);

    const records = await OwnerAttendance.find(query)
      .sort({ date: -1 })
      .lean();

    // Single-pass summary (O(n))
    const summary = {
      presentDays: 0,
      absentDays: 0,
      halfDays: 0,
      totalHours: 0,
      grossTotal: 0,
    };

    for (const r of records) {
      if (r.status === "present") summary.presentDays += 1;
      else if (r.status === "absent") summary.absentDays += 1;
      else if (r.status === "half_day") summary.halfDays += 1;

      summary.totalHours += r.hoursWorked || 0;
      summary.grossTotal += r.salaryForDay || 0;
    }

    return res.json({
      success: true,
      records,
      summary,
      contract,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const ownerDeleteRecord = async (req, res) => {
  try {
    const ownerId = uidFromReq(req);
    const recordId = req.params.id;

    if (!isValidObjectId(recordId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid record ID",
      });
    }
    const deleted = await OwnerAttendance.findOneAndDelete({
      _id: recordId,
      ownerId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }

    return res.json({
      success: true,
      message: "Record delete ho gaya",
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const ownerGetAllContracts = async (req, res) => {
  try {
    const contracts = await Contract.find({
      ownerId: uidFromReq(req),
      status: "active",
    })
      .populate("driverId", "name phone")
      .populate("jobId", "title vehicleType vehicleCategory")
      .lean();

    return res.json({ success: true, contracts });
  } catch (error) {
    return sendServerError(res);
  }
};

module.exports = {
  calculateDaySalary,
  driverAddRecord,
  driverGetRecords,
  driverDeleteRecord,
  ownerAddRecord,
  ownerGetRecords,
  ownerDeleteRecord,
  ownerGetAllContracts,
};
