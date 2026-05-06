const { UserSignupSchemaDatas } = require("../models/webmodel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validateSignupInput } = require("../utils/validation");
const { sendOtpEmail } = require("../utils/emailService");




// user Signup Api

const userSignupController = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      firstName,
      lastName,
      email,
      password,
    } = req.body;

    const sanitizedFirstName = firstName?.trim();
    const sanitizedLastName = lastName?.trim();
    const sanitizedEmail = email?.trim().toLowerCase();

    // Validate input using the validation utility
    const { isValid, errors } = validateSignupInput(
      sanitizedFirstName,
      sanitizedLastName,
      sanitizedEmail,
      password
    );

    if (!isValid) {
      return res.status(400).json({
        status: "error",
        errors,
      });
    }

    // Check for existing user
    const existingUser = await UserSignupSchemaDatas.findOne({
      email: sanitizedEmail,
    }).lean();

    if (existingUser) {
      return res.status(409).json({
        status: "error",
        message: "An account with this email already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate 6-digit OTP with 10-minute expiry
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Create new user
    const newUser = new UserSignupSchemaDatas({
      firstName: sanitizedFirstName,
      lastName: sanitizedLastName,
      email: sanitizedEmail,
      password: hashedPassword,
      otp,
      otpExpiry,
      createdAt: new Date(),
    });

    await newUser.save();

    // Send OTP email
    try {
      await sendOtpEmail(newUser, otp);
    } catch (emailError) {
      console.error("OTP email failed:", emailError);
    }

    res.status(201).json({
      status: "success",
      message: "Account created! Please check your email for the 6-digit OTP to verify your account.",
      data: {
        userId: newUser._id,
        email: sanitizedEmail,
        requiresOtpVerification: true,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid input data",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        status: "error",
        message: "An account with this email already exists",
      });
    }

    res.status(500).json({
      status: "error",
      message: "An error occurred while creating your account. Please try again later.",
    });
  }
};




// user Login Api
const userLoginController = async (req, res) => {
  try {
    const body = req.body || {};
    const email = body.email;
    const password = body.password;

    if (!email || !password) {
      return res
        .status(400)
        .json({ status: "error", message: "Email and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Find user by email
    const user = await UserSignupSchemaDatas.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res
        .status(401)
        .json({ status: "error", message: "Invalid email or password" });
    }

    // Check if verified
    if (!user.isVerified) {
      return res
        .status(403)
        .json({
          status: "error",
          message: "Email not verified. Please verify your email before logging in.",
        });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ status: "error", message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // Update lastLogin
    try {
      user.lastLogin = new Date();
      await user.save();
    } catch (e) {
      console.warn("Could not update lastLogin:", e.message);
    }

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      status: "success",
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        },
      },
    });

  } catch (error) {
    console.error("Login error:", error);
    return res
      .status(500)
      .json({ status: "error", message: "An error occurred while logging in" });
  }
};


module.exports = {
    userLoginController,
    userSignupController
}
