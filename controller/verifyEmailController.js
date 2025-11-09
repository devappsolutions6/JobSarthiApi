const jwt = require("jsonwebtoken");
const { UserSignupSchemaDatas } = require("../models/webmodel");

const verifyEmailController = async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(400).json({ message: "Token is missing" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserSignupSchemaDatas.findOne({ Email: decoded.email });

    if (!user) return res.status(400).json({ message: "User not found" });

    if (user.isVerified)
      return res.status(200).json({ message: "Email already verified" });

    user.isVerified = true;
    user.verificationToken = null;
    await user.save();

    res.status(200).json({ message: "Email verified successfully!" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "Invalid or expired token" }); 
  }
};

module.exports = { verifyEmailController };
