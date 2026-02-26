const jwt = require("jsonwebtoken");
const { UserSignupSchemaDatas } = require("../models/webmodel");
const { sendOtpEmail } = require("../utils/emailService");

// Verify OTP submitted by user
const verifyOtpController = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ status: "error", message: "Email and OTP are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await UserSignupSchemaDatas.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ status: "error", message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ status: "error", message: "Email is already verified. Please login." });
    }

    if (!user.otp || !user.otpExpiry) {
      return res.status(400).json({ status: "error", message: "OTP not found. Please request a new one." });
    }

    if (new Date() > user.otpExpiry) {
      return res.status(400).json({ status: "error", message: "OTP has expired. Please request a new one." });
    }

    if (user.otp !== String(otp).trim()) {
      return res.status(400).json({ status: "error", message: "Invalid OTP. Please try again." });
    }

    // Mark as verified and clear OTP
    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    // Generate auth token
    const authToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", authToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      status: "success",
      message: "Email verified successfully!",
      data: {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        },
        token: authToken,
      },
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ status: "error", message: "Verification failed. Please try again." });
  }
};

// Resend OTP to the user's email
const resendOtpController = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ status: "error", message: "Email is required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await UserSignupSchemaDatas.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ status: "error", message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ status: "error", message: "Email is already verified. Please login." });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    try {
      await sendOtpEmail(user, otp);
    } catch (emailError) {
      console.error("Resend OTP email failed:", emailError);
      return res.status(500).json({ status: "error", message: "Failed to send OTP email. Please try again." });
    }

    res.status(200).json({
      status: "success",
      message: "A new OTP has been sent to your email.",
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ status: "error", message: "Failed to resend OTP. Please try again." });
  }
};

module.exports = { verifyOtpController, resendOtpController };
