const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const PHONE_REGEX = /^\d{10}$/;
const BCRYPT_SALT_ROUNDS = 12; // Industry standard 2024+
const JWT_EXPIRY = "7d";

// Validate JWT_SECRET at module load
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const sendServerError = (res) => {
  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Server error'
      : undefined,
  });
};

const buildUserPayload = (userDoc) => {
  const u = userDoc.toObject ? userDoc.toObject() : userDoc;
  return {
    _id: u._id,
    name: u.name,
    phone: u.phone,
    role: u.role,
    location: u.location,
    profilePhoto: u.profilePhoto || null,
    isVerified: u.isVerified,
    isBlocked: u.isBlocked,
    subscription: u.subscription,
    isProfileComplete: u.isProfileComplete,
    createdAt: u.createdAt,
  };
};

const register = async (req, res) => {
  try {
    const {
      name,
      phone,
      password,
      confirmPassword,
      role,
      state,
      district,
    } = req.body;

    // All fields required
    if (
      !name ||
      !phone ||
      !password ||
      confirmPassword === undefined ||
      confirmPassword === null ||
      !role ||
      !state ||
      !district
    ) {
      return res.status(400).json({
        success: false,
        message: "Sab fields zaroori hain",
      });
    }

    // Sanitize inputs
    const nameTrim = String(name).trim();
    const phoneTrim = String(phone).trim();
    const stateTrim = String(state).trim();
    const districtTrim = String(district).trim();

    // Name length validation
    if (nameTrim.length < 2 || nameTrim.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Naam 2 se 100 characters ka hona chahiye",
      });
    }

    // Phone validation
    if (!PHONE_REGEX.test(phoneTrim)) {
      return res.status(400).json({
        success: false,
        message: "Phone number 10 digit ka hona chahiye",
      });
    }

    // Password validation
    const passwordStr = String(password);
    if (passwordStr.length < 6 || passwordStr.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Password 6 se 100 characters ka hona chahiye",
      });
    }

    if (passwordStr !== String(confirmPassword)) {
      return res.status(400).json({
        success: false,
        message: "Confirm password password se match nahi karta",
      });
    }

    // Role validation
    if (role !== "owner" && role !== "driver") {
      return res.status(400).json({
        success: false,
        message: "Role sirf owner ya driver ho sakta hai",
      });
    }

    // State/District validation
    if (stateTrim.length < 2 || stateTrim.length > 100) {
      return res.status(400).json({
        success: false,
        message: "State sahi se daalein",
      });
    }
    if (districtTrim.length < 2 || districtTrim.length > 100) {
      return res.status(400).json({
        success: false,
        message: "District sahi se daalein",
      });
    }

    // Check existing user
    const existing = await User.findOne({ phone: phoneTrim }).lean();
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Yeh phone number pehle se registered hai",
      });
    }

    // Hash password (stronger salt rounds)
    const hashed = await bcrypt.hash(passwordStr, BCRYPT_SALT_ROUNDS);

    // Create user
    const user = await User.create({
      name: nameTrim,
      phone: phoneTrim,
      password: hashed,
      role,
      location: {
        state: stateTrim,
        district: districtTrim,
      },
    });

    // Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return res.status(201).json({
      success: true,
      token,
      user: buildUserPayload(user),
    });
  } catch (error) {
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Yeh phone number pehle se registered hai",
      });
    }
    return sendServerError(res);
  }
};

const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Input validation
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone aur password zaroori hain",
      });
    }

    const phoneTrim = String(phone).trim();

    // Validate phone format (prevent injection)
    if (!PHONE_REGEX.test(phoneTrim)) {
      return res.status(401).json({
        success: false,
        message: "Invalid phone or password",
      });
    }

    // Find user (need full doc for save() if unblock)
    const user = await User.findOne({ phone: phoneTrim });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid phone or password",
      });
    }

    // Auto-unblock if block expired
    if (
      user.isBlocked &&
      user.blockUntil &&
      new Date(user.blockUntil) <= new Date()
    ) {
      user.isBlocked = false;
      user.blockReason = "";
      user.blockUntil = null;
      await user.save();
    }

    // Still blocked?
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Aapka account block hai. Admin se contact karein.",
      });
    }

    // Verify password
    const match = await bcrypt.compare(String(password), user.password);
    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Invalid phone or password",
      });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return res.json({
      success: true,
      token,
      user: buildUserPayload(user),
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User
      .findById(req.user._id)
      .select("-password")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila",
      });
    }

    return res.json({
      success: true,
      user: buildUserPayload(user),
    });
  } catch (error) {
    return sendServerError(res);
  }
};

const checkPhone = async (req, res) => {
  try {
    const phone = String(req.query.phone || "").trim();

    // Use shared PHONE_REGEX
    if (!PHONE_REGEX.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number",
      });
    }

    const user = await User.findOne({
      phone,
      role: 'driver',
    })
      .select('name phone location profilePhoto isVerified')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Driver nahi mila',
      });
    }

    return res.json({
      success: true,
      driver: user,
    });
  } catch (error) {
    return sendServerError(res);
  }
};

module.exports = { register, login, getMe, checkPhone };
