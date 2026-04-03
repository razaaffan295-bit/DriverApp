require('dotenv').config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes =
  require("./routes/authRoutes");
const ownerRoutes =
  require("./routes/ownerRoutes");
const jobRoutes =
  require("./routes/jobRoutes");
const driverRoutes =
  require("./routes/driverRoutes");
const applicationRoutes =
  require("./routes/applicationRoutes");
const messageRoutes =
  require("./routes/messageRoutes");
const notificationRoutes =
  require("./routes/notificationRoutes");
const contractRoutes =
  require("./routes/contractRoutes");
const attendanceRoutes =
  require("./routes/attendanceRoutes");
const paymentRoutes =
  require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const complaintRoutes =
  require("./routes/complaintRoutes");
const ratingRoutes = require("./routes/ratingRoutes");
const resignRoutes = require("./routes/resignRoutes");
const tripRoutes = 
  require('./routes/tripRoutes')
const inviteRoutes =
  require('./routes/inviteRoutes')
const subscriptionRoutes =
  require('./routes/subscriptionRoutes')

connectDB();

const app = express();

app.use(cors());
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));

app.get("/", (req, res) => {
  res.json({
    message: "DriverApp API Running",
    version: "1.0.0",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/owner", ownerRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/resign", resignRoutes);
app.use('/api/trips', tripRoutes)
app.use('/api/invites', inviteRoutes)
app.use('/api/subscription', subscriptionRoutes)

app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Server Error",
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${PORT}`);
});
