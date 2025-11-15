const jwt = require('jsonwebtoken');
const { UserSignupSchemaDatas } = require('../models/webmodel');

// Authentication middleware - checks Authorization header for Bearer token
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ message: "Authentication required" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    
    const query = decoded.userId ? { _id: decoded.userId } : { Email: decoded.email };
    const user = await UserSignupSchemaDatas.findOne(query).select("-Password -verificationToken -__v");
    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = authMiddleware;
