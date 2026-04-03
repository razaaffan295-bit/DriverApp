const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const PHONE_REGEX = /^\d{10}$/;

const buildUserPayload = (userDoc) => {
  const u = userDoc.toObject ? userDoc.toObject() : userDoc;
  delete u.password;
  return {
    _id: u._id,
    name: u.name,
    phone: u.phone,
    role: u.role,
    location: u.location,
    isVerified: u.isVerified,
    isBlocked: u.isBlocked,
    subscription: u.subscription,
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

    if (!PHONE_REGEX.test(String(phone).trim())) {
      return res.status(400).json({
        success: false,
        message: "Phone number 10 digit ka hona chahiye",
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password kam se kam 6 characters ka hona chahiye",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Confirm password password se match nahi karta",
      });
    }

    if (role !== "owner" && role !== "driver") {
      return res.status(400).json({
        success: false,
        message: "Role sirf owner ya driver ho sakta hai",
      });
    }

    const phoneTrim = String(phone).trim();
    const existing = await User.findOne({ phone: phoneTrim });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Yeh phone number pehle se registered hai",
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: String(name).trim(),
      phone: phoneTrim,
      password: hashed,
      role,
      location: {
        state: String(state).trim(),
        district: String(district).trim(),
      },
    });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      success: true,
      token,
      user: buildUserPayload(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Yeh phone number pehle se registered hai",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone aur password zaroori hain",
      });
    }

    const phoneTrim = String(phone).trim();
    const user = await User.findOne({ phone: phoneTrim });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Yeh phone number registered nahi hai",
      });
    }

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
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Aapka account block hai. Admin se contact karein.",
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Password galat hai",
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      token,
      user: buildUserPayload(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
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
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const checkPhone = async (req, res) => {
  try {
    const { phone } = req.query

    const user = await User.findOne({
      phone,
      role: 'driver',
    }).select('name phone location profilePhoto isVerified')

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Driver nahi mila',
      })
    }

    return res.json({
      success: true,
      driver: user,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

module.exports = { register, login, getMe, checkPhone };
