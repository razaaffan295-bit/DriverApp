const jwt = require("jsonwebtoken");
const User = require("../models/User");

const verifyToken = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Login karein pehle",
      });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User nahi mila",
      });
    }
    if (user.isBlocked && user.blockUntil && new Date(user.blockUntil) <= new Date()) {
      user.isBlocked = false;
      user.blockReason = "";
      user.blockUntil = null;
      await user.save();
    }
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Aapka account block hai",
      });
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Token invalid hai",
    });
  }
};

const isOwner = (req, res, next) => {
  if (req.user.role !== "owner") {
    return res.status(403).json({
      success: false,
      message: "Sirf owner access kar sakta hai",
    });
  }
  next();
};

const isDriver = (req, res, next) => {
  if (req.user.role !== "driver") {
    return res.status(403).json({
      success: false,
      message: "Sirf driver access kar sakta hai",
    });
  }
  next();
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Sirf admin access kar sakta hai",
    });
  }
  next();
};

module.exports = { verifyToken, isOwner, isDriver, isAdmin };
