require("./instrument.js");
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
const uploadRoutes = require('./routes/uploadRoutes')

const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const { ipKeyGenerator } = rateLimit

connectDB();

const app = express();
app.set('trust proxy', 1)

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
  })
)

// CORS
app.options('*', cors())
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [
        'http://localhost:3000',
        'http://localhost:5000',
        'https://driver-app-neon.vercel.app',
        'capacitor://localhost',
        'http://localhost',
        'https://localhost',
        process.env.FRONTEND_URL,
      ].filter(Boolean)

      if (
        !origin ||
        allowed.includes(origin) ||
        origin.startsWith('capacitor://') ||
        origin.startsWith('ionic://') ||
        origin === 'null'
      ) {
        callback(null, true)
      } else {
        callback(new Error('CORS not allowed'))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

// General rate limit
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const auth = req.headers.authorization
    if (auth) return auth
    return ipKeyGenerator(req.ip || '')
  },
  message: {
    success: false,
    message: 'Bahut zyada requests. Thoda ruko!',
  },
  skip: (req) => {
    const skipPaths = [
      '/api/notifications',
      '/api/messages/conversations',
      '/api/payments/summary',
    ]
    return skipPaths.some((path) => req.path.startsWith(path))
  },
})
app.use('/api/', generalLimiter)

// Auth rate limit (strict)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message:
      'Bahut zyada login attempts! 15 minute baad try karein.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/auth/', authLimiter)

// Subscription rate limit
const subscriptionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => {
    const auth = req.headers.authorization
    if (auth) return auth
    return ipKeyGenerator(req.ip || '')
  },
  message: {
    success: false,
    message:
      'Bahut zyada payment attempts! 1 ghante baad try karein.',
  },
})
app.use('/api/subscription/', subscriptionLimiter)

// Request size limit
app.use(express.json({ limit: '10mb' }))
app.use(
  express.urlencoded({
    limit: '10mb',
    extended: true,
  })
)

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
app.use('/api/upload', uploadRoutes)

const Sentry = require("@sentry/node");
Sentry.setupExpressErrorHandler(app);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Server Error",
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${PORT}`);
});
