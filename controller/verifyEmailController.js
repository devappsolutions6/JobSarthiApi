const jwt = require("jsonwebtoken");
const { UserSignupSchemaDatas } = require("../models/webmodel");

const verifyEmailController = async (req, res) => {
  try {
    const token = req.query.token;
    if (!token)
      return res.status(400).json({ status: "error", message: "Token is missing" });

    // Verify token validity
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserSignupSchemaDatas.findOne({ Email: decoded.email });

    if (!user)
      return res.status(400).json({ status: "error", message: "User not found" });

    if (user.isVerified) {
      const authToken = jwt.sign(
        { userId: user._id, email: user.Email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.status(200).json({
        status: "success",
        message: "Email already verified",
        data: {
          user: {
            _id: user._id,
            firstName: user.FirstName,
            lastName: user.LastName,
            email: user.Email,
          },
          token: authToken,
        },
      });
    }

  
    user.isVerified = true;
    user.verificationToken = null;
    await user.save();

    //  Generate login token
    const authToken = jwt.sign(
      { userId: user._id, email: user.Email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      status: "success",
      message: "Email verified successfully!",
      data: {
        user: {
          _id: user._id,
          firstName: user.FirstName,
          lastName: user.LastName,
          email: user.Email,
        },
        token: authToken,
      },
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(400).json({
      status: "error",
      message: "Invalid or expired token",
    });
  }
};

module.exports = { verifyEmailController };

