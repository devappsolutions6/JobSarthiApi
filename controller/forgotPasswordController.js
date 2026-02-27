const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { UserSignupSchemaDatas } = require("../models/webmodel");
const { sendPasswordResetOtpEmail } = require("../utils/emailService");

// Step 1: Send OTP to the user's registered email
const forgotPasswordController = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ status: "error", message: "Email is required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await UserSignupSchemaDatas.findOne({ email: normalizedEmail });

    // Always respond the same way to avoid email enumeration
    if (!user || !user.isVerified) {
      return res.status(200).json({
        status: "success",
        message: "If this email is registered, you will receive an OTP shortly.",
      });
    }

    // Generate 6-digit OTP with 10-minute expiry
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.resetOtp = otp;
    user.resetOtpExpiry = resetOtpExpiry;
    await user.save();

    try {
      await sendPasswordResetOtpEmail(user, otp);
    } catch (emailError) {
      console.error("Password reset OTP email failed:", emailError);
      return res.status(500).json({ status: "error", message: "Failed to send OTP email. Please try again." });
    }

    res.status(200).json({
      status: "success",
      message: "If this email is registered, you will receive an OTP shortly.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ status: "error", message: "Something went wrong. Please try again." });
  }
};

// Step 2: Verify the OTP and return a short-lived reset token
const verifyResetOtpController = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ status: "error", message: "Email and OTP are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await UserSignupSchemaDatas.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ status: "error", message: "Invalid OTP or email" });
    }

    if (!user.resetOtp || !user.resetOtpExpiry) {
      return res.status(400).json({ status: "error", message: "No OTP found. Please request a new one." });
    }

    if (new Date() > user.resetOtpExpiry) {
      user.resetOtp = null;
      user.resetOtpExpiry = null;
      await user.save();
      return res.status(400).json({ status: "error", message: "OTP has expired. Please request a new one." });
    }

    if (user.resetOtp !== String(otp).trim()) {
      return res.status(400).json({ status: "error", message: "Invalid OTP. Please try again." });
    }

    // OTP is valid — clear it and issue a short-lived reset token
    user.resetOtp = null;
    user.resetOtpExpiry = null;
    await user.save();

    const resetToken = jwt.sign(
      { userId: user._id, email: user.email, purpose: "password_reset" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.status(200).json({
      status: "success",
      message: "OTP verified. You may now reset your password.",
      data: { resetToken },
    });
  } catch (error) {
    console.error("Verify reset OTP error:", error);
    res.status(500).json({ status: "error", message: "Verification failed. Please try again." });
  }
};

// Step 3: Reset the password using the short-lived reset token
const resetPasswordController = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ status: "error", message: "Reset token and new password are required" });
    }

    // Validate new password length
    if (newPassword.length < 8) {
      return res.status(400).json({ status: "error", message: "Password must be at least 8 characters long" });
    }

    // Verify the reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ status: "error", message: "Reset link has expired. Please start over." });
    }

    if (decoded.purpose !== "password_reset") {
      return res.status(400).json({ status: "error", message: "Invalid reset token" });
    }

    const user = await UserSignupSchemaDatas.findById(decoded.userId);
    if (!user) {
      return res.status(400).json({ status: "error", message: "User not found" });
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      status: "success",
      message: "Password reset successfully! You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ status: "error", message: "Failed to reset password. Please try again." });
  }
};

module.exports = { forgotPasswordController, verifyResetOtpController, resetPasswordController };
