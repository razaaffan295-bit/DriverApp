const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Validate JWT_SECRET at module load (fail fast)
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_SECRET = process.env.JWT_SECRET;

// Helper for consistent 500 responses
const sendServerError = (res) => {
  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Server error'
      : undefined,
  });
};

const verifyToken = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    let token;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Login karein pehle",
      });
    }

    // Verify JWT signature + expiry
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      // Differentiate expired vs invalid for better UX
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: "Session expire ho gayi. Phir se login karein.",
          code: "TOKEN_EXPIRED",
        });
      }
      return res.status(401).json({
        success: false,
        message: "Token invalid hai",
        code: "TOKEN_INVALID",
      });
    }

    // Validate decoded payload structure
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Token invalid hai",
        code: "TOKEN_INVALID",
      });
    }

    // Fetch user (lean for speed - we only need data, not methods)
    const user = await User.findById(decoded.id)
      .select("-password")
      .lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User nahi mila",
      });
    }

    // Check if currently blocked
    const isCurrentlyBlocked =
      user.isBlocked &&
      (!user.blockUntil || new Date(user.blockUntil) > new Date());

    if (isCurrentlyBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked",
        code: "ACCOUNT_BLOCKED",
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    // Unexpected errors (DB connection, etc.)
    return sendServerError(res);
  }
};

const isOwner = (req, res, next) => {
  if (!req.user || req.user.role !== "owner") {
    return res.status(403).json({
      success: false,
      message: "Sirf owner access kar sakta hai",
    });
  }
  next();
};

const isDriver = (req, res, next) => {
  if (!req.user || req.user.role !== "driver") {
    return res.status(403).json({
      success: false,
      message: "Sirf driver access kar sakta hai",
    });
  }
  next();
};

const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Sirf admin access kar sakta hai",
    });
  }
  next();
};

module.exports = { verifyToken, isOwner, isDriver, isAdmin };
