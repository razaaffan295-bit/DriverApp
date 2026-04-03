require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  // eslint-disable-next-line no-console
  console.error("MONGO_URI missing in .env");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    const existing = await User.findOne({ role: "admin" });
    if (existing) {
      // eslint-disable-next-line no-console
      console.log("Admin already exists");
      process.exit(0);
    }

    const password = await bcrypt.hash("admin123456", 10);

    await User.create({
      name: "Admin",
      phone: "0000000000",
      password,
      role: "admin",
      location: {
        state: "Bihar",
        district: "Patna",
      },
      isVerified: true,
    });

    // eslint-disable-next-line no-console
    console.log("Admin created!");
    // eslint-disable-next-line no-console
    console.log("Phone: 0000000000");
    // eslint-disable-next-line no-console
    console.log("Password: admin123456");
    process.exit(0);
  })
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  });
