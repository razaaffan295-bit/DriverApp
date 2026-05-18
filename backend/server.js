const dns = require('dns')
dns.setDefaultResultOrder('ipv4first')
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
const adminSubRoutes = require('./routes/adminSubscriptionRoutes')
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
const compression = require('compression')
const requestLogger = require('./middleware/requestLogger')
const { ipKeyGenerator } = rateLimit

connectDB();

const app = express();
app.set('trust proxy', 1)

// Response compression - 70% smaller responses
app.use(compression())

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

app.use(requestLogger)

// General rate limit
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
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
    // Skip GET routes that are read-heavy
    const skipPaths = [
      '/api/notifications',
      '/api/messages/conversations',
      '/api/payments/summary',
      '/api/payments/owner-summary',
      '/api/payments/history',
      '/api/payments/advances',
      '/api/trips',
      '/api/contracts',
      '/api/attendance',
      '/api/jobs',
      '/api/applications',
      '/api/ratings',
      '/api/invites',
    ]
    // Only skip GET requests
    if (req.method !== 'GET') return false
    return skipPaths.some((path) => req.path.startsWith(path))
  },
})
app.use('/api/', generalLimiter)

// Auth rate limit (strict)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message:
      'Bahut zyada login attempts! 15 minute baad try karein.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/auth/', authLimiter)

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const phone = req.body?.phone
    return phone
      ? `login_${phone}`
      : ipKeyGenerator(req.ip || '')
  },
  message: {
    success: false,
    message: 'Too many login attempts. Try after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Subscription rate limit
const subscriptionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  keyGenerator: (req) => {
    const auth = req.headers.authorization
    if (auth) return auth
    return ipKeyGenerator(req.ip || '')
  },
  message: {
    success: false,
    message:
      'Bahut zyada payment attempts! Thoda ruko.',
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

app.use('/api/auth/login', loginLimiter)

const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 500,
  keyGenerator: (req) => {
    const auth = req.headers.authorization
    if (auth) return auth
    return ipKeyGenerator(req.ip || '')
  },
  message: {
    success: false,
    message: 'Too many payment requests. Try after some time.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip GET requests - they are safe
  skip: (req) => req.method === 'GET',
})

// Health check endpoint
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose')
  const dbStatus = mongoose.connection.readyState
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  }

  const uptime = process.uptime()
  const memory = process.memoryUsage()
  const memoryMB = Math.round(
    memory.heapUsed / 1024 / 1024
  )

  res.json({
    success: true,
    status: 'healthy',
    uptime: `${Math.floor(uptime / 60)} min`,
    database: dbStates[dbStatus] || 'unknown',
    memory: `${memoryMB} MB`,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  })
})

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
app.use('/api/payments/', paymentLimiter)
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use('/api/admin/subscriptions', adminSubRoutes)
app.use("/api/complaints", complaintRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/resign", resignRoutes);
app.use('/api/trips', tripRoutes)
app.use('/api/invites', inviteRoutes)
app.use('/api/subscription', subscriptionRoutes)
app.use('/api/upload', uploadRoutes)

const { runSubscriptionCron } = require('./cron/subscriptionCron')
runSubscriptionCron()

const Sentry = require("@sentry/node");
Sentry.setupExpressErrorHandler(app);

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', {
    message: err.message,
    path: req.originalUrl,
    method: req.method,
    user: req.user?._id || 'guest',
    timestamp: new Date().toISOString(),
  })

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: Object.values(err.errors).map(
        (e) => e.message
      ),
    })
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0]
    return res.status(400).json({
      success: false,
      message: `${field} already exists`,
    })
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
    })
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired, please login again',
    })
  }

  // CORS error
  if (err.message === 'CORS not allowed') {
    return res.status(403).json({
      success: false,
      message: 'CORS not allowed',
    })
  }

  // Default 500
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Server Error'
      : err.message,
  })
})

// 404 handler - must be last
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  })
})

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${PORT}`);
});
