const { UserSignupSchemaDatas } = require("../models/webmodel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validateSignupInput } = require("../utils/validation");
const { sendOtpEmail } = require("../utils/emailService");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);




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

    // Generate JWT tokens
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET + "_refresh",
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d" }
    );

    // Update refreshToken and lastLogin in DB
    try {
      user.refreshToken = refreshToken;
      user.lastLogin = new Date();
      await user.save();
    } catch (e) {
      console.warn("Could not update user session data:", e.message);
    }

    res.cookie("token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
      maxAge: 2 * 24 * 60 * 60 * 1000, // 2 days
    });

    return res.status(200).json({
      status: "success",
      message: "Login successful",
      data: {
        token: accessToken,
        refreshToken: refreshToken,
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


// Google Login Api
const googleLoginController = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ status: "error", message: "Google credential is required" });
    }

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, given_name, family_name, picture, sub: googleId } = payload;

    // Find or create user
    let user = await UserSignupSchemaDatas.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Create new user if doesn't exist
      user = new UserSignupSchemaDatas({
        firstName: given_name,
        lastName: family_name || "",
        email: email.toLowerCase(),
        password: await bcrypt.hash(Math.random().toString(36).slice(-10), 12), // Dummy password
        isVerified: true, // Google users are pre-verified
        googleId,
        avatar: picture,
        createdAt: new Date(),
      });
      await user.save();
    } else {
      // If user exists but not verified, mark as verified (since Google email is verified)
      if (!user.isVerified) {
        user.isVerified = true;
      }
      // Update googleId if not present
      if (!user.googleId) {
        user.googleId = googleId;
      }
      await user.save();
    }

    // Generate JWT tokens (Reuse logic from login)
    const accessToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET + "_refresh",
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d" }
    );

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    res.cookie("token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
      maxAge: 2 * 24 * 60 * 60 * 1000, // 2 days
    });

    return res.status(200).json({
      status: "success",
      message: "Google login successful",
      data: {
        token: accessToken,
        refreshToken: refreshToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        },
      },
    });

  } catch (error) {
    console.error("Google login error:", error);
    return res.status(500).json({ status: "error", message: "Google authentication failed" });
  }
};


// Refresh Token Controller
const refreshTokenController = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ status: "error", message: "Refresh token is required" });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET + "_refresh");
    } catch (err) {
      return res.status(401).json({ status: "error", message: "Invalid or expired refresh token" });
    }

    // Check if user exists and token matches
    const user = await UserSignupSchemaDatas.findById(decoded.userId);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ status: "error", message: "Invalid refresh token session" });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
    );

    // Optional: Rotate refresh token
    const newRefreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET + "_refresh",
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d" }
    );

    user.refreshToken = newRefreshToken;
    await user.save();

    res.cookie("token", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
      maxAge: 2 * 24 * 60 * 60 * 1000, // 2 days
    });

    return res.status(200).json({
      status: "success",
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        }
      }
    });

  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
};


module.exports = {
    userLoginController,
    userSignupController,
    refreshTokenController,
    googleLoginController
}
