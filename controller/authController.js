const { UserSignupSchemaDatas } = require("../models/webmodel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validateSignupInput } = require("../utils/validation");
const { sendVerificationEmail } = require("../utils/emailService");




// user Singnup Api


const userSignupController = async (req, res) => {
  try {
    // 1. Sanitize and validate input
    const body = req.body || {};
    const { firstName, lastName, email, password } = body;

    // Remove any unwanted characters and trim whitespace
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

    // 2. Check for existing user
    const existingUser = await UserSignupSchemaDatas.findOne({
      Email: sanitizedEmail,
    }).lean();

    if (existingUser) {
      return res.status(409).json({
        status: "error",
        message: "An account with this email already exists",
      });
    }

    // 3. Hash password with appropriate cost factor
    const hashedPassword = await bcrypt.hash(password, 12);

    // 4. Create verification token with appropriate expiry
    const verificationToken = jwt.sign(
      {
        email: sanitizedEmail,
        timestamp: Date.now(),
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // 5. Create new user with sanitized data
    const newUser = new UserSignupSchemaDatas({
      FirstName: sanitizedFirstName,
      LastName: sanitizedLastName,
      Email: sanitizedEmail,
      Password: hashedPassword,
      verificationToken,
      createdAt: new Date(),
    });

    // 6. Save user to database
    await newUser.save();

    // 7. Send verification email
    try {
      await sendVerificationEmail(newUser, verificationToken);
    } catch (emailError) {
      // If email fails, log it but don't fail the registration
      console.error("Verification email failed:", emailError);
      // You might want to implement a retry mechanism here
    }

    // 8. Return success response without sensitive data
    res.status(201).json({
      status: "success",
      message:
        "Account created successfully. Please check your email to verify your account.",
      data: {
        userId: newUser._id,
        email: sanitizedEmail,
        requiresVerification: true,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);

    // 9. Handle different types of errors appropriately
    if (error.name === "ValidationError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid input data",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }

    if (error.code === 11000) {
      // Duplicate key error
      return res.status(409).json({
        status: "error",
        message: "An account with this email already exists",
      });
    }

    // 10. Generic error response
    res.status(500).json({
      status: "error",
      message:
        "An error occurred while creating your account. Please try again later.",
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
      Email: normalizedEmail,
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
          message:
            "Email not verified. Please verify your email before logging in.",
        });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.Password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ status: "error", message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.Email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // Optionally: update lastLogin timestamps
    try {
      user.lastLogin = new Date();
      await user.save();
    } catch (e) {
      // non-fatal
      console.warn("Could not update lastLogin:", e.message);
    }


   res.cookie("token", token, {
  httpOnly: true,
  secure: true,        // 🔥 production → https required
  sameSite: "none",    // 🔥 required for cross-origin
  path: "/",           // 🔥 required
  maxAge: 7 * 24 * 60 * 60 * 1000,
});


return res.status(200).json({
  status: "success",
  message: "Login successful",
  data: {
    user: {
      id: user._id,
      firstName: user.FirstName,
      lastName: user.LastName,
      email: user.Email,
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