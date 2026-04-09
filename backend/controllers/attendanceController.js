const DriverAttendance = require("../models/DriverAttendance");
const OwnerAttendance = require("../models/OwnerAttendance");
const Contract = require("../models/Contract");

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

    const hoursWorked =
      Number(req.body.hoursWorked) || 0;

    if (!date || !status) {
      return res.status(400).json({
        success: false,
        message: "Date aur status required hai",
      });
    }

    const contract = await Contract.findOne({
      driverId: req.user.id,
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

    const recordDate = new Date(date);
    recordDate.setHours(0, 0, 0, 0);

    const existing = await DriverAttendance.findOne({
      contractId: contract._id,
      driverId: req.user.id,
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
      driverId: req.user.id,
      ownerId: contract.ownerId,
      date: recordDate,
      month: recordDate.getMonth() + 1,
      year: recordDate.getFullYear(),
      status,
      hoursWorked: Number(req.body.hoursWorked) || 0,
      note: note || "",
      salaryForDay,
    });

    return res.json({
      success: true,
      record,
      message: "Record save ho gaya!",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const driverGetRecords = async (req, res) => {
  try {
    const { month, year } = req.query;

    const contract = await Contract.findOne({
      driverId: req.user.id,
      status: "active",
    });

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
      driverId: req.user.id,
    };

    if (month) query.month = Number(month);
    if (year) query.year = Number(year);

    const records = await DriverAttendance.find(query).sort({ date: -1 });

    const summary = {
      presentDays: 0,
      absentDays: 0,
      halfDays: 0,
      totalHours: 0,
      grossTotal: 0,
    };

    records.forEach((r) => {
      if (r.status === "present") summary.presentDays += 1;
      else if (r.status === "absent") summary.absentDays += 1;
      else if (r.status === "half_day") summary.halfDays += 1;

      summary.totalHours += r.hoursWorked || 0;
      summary.grossTotal += r.salaryForDay || 0;
    });

    return res.json({
      success: true,
      records,
      summary,
      contract,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const driverDeleteRecord = async (req, res) => {
  try {
    await DriverAttendance.findOneAndDelete({
      _id: req.params.id,
      driverId: req.user.id,
    });

    return res.json({
      success: true,
      message: "Record delete ho gaya",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
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

    const contract = await Contract.findOne({
      _id: contractId,
      ownerId: req.user.id,
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
      ownerId: req.user.id,
      date: recordDate,
      month: recordDate.getMonth() + 1,
      year: recordDate.getFullYear(),
      status,
      hoursWorked: Number(hoursWorked) || 0,
      note: note || "",
      salaryForDay,
    });

    return res.json({
      success: true,
      record,
      message: "Record save ho gaya!",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
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

    const contract = await Contract.findOne({
      _id: contractId,
      ownerId: req.user.id,
    }).populate("driverId", "name phone");

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract nahi mila",
      });
    }

    const query = {
      contractId,
      ownerId: req.user.id,
    };

    if (month) query.month = Number(month);
    if (year) query.year = Number(year);

    const records = await OwnerAttendance.find(query).sort({ date: -1 });

    const summary = {
      presentDays: 0,
      absentDays: 0,
      halfDays: 0,
      totalHours: 0,
      grossTotal: 0,
    };

    records.forEach((r) => {
      if (r.status === "present") summary.presentDays += 1;
      else if (r.status === "absent") summary.absentDays += 1;
      else if (r.status === "half_day") summary.halfDays += 1;

      summary.totalHours += r.hoursWorked || 0;
      summary.grossTotal += r.salaryForDay || 0;
    });

    return res.json({
      success: true,
      records,
      summary,
      contract,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const ownerDeleteRecord = async (req, res) => {
  try {
    await OwnerAttendance.findOneAndDelete({
      _id: req.params.id,
      ownerId: req.user.id,
    });

    return res.json({
      success: true,
      message: "Record delete ho gaya",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const ownerGetAllContracts = async (req, res) => {
  try {
    const contracts = await Contract.find({
      ownerId: req.user.id,
      status: "active",
    })
      .populate("driverId", "name phone")
      .populate("jobId", "title vehicleType vehicleCategory");

    return res.json({ success: true, contracts });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
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
