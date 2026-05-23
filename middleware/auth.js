const jwt = require('jsonwebtoken');
const { UserSignupSchemaDatas } = require('../models/webmodel');
const { getCache, setCache } = require('../utils/cache');

// Authentication middleware - checks Authorization header for Bearer token
const authMiddleware = async (req, res, next) => {
  try {
    let token = req.cookies?.token;

    // Also check Authorization header
    const authHeader = req.headers.authorization;
    if (!token && authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) return res.status(401).json({ message: "Authentication required" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Dynamic cache key construction based on decodes
    const cacheKey = decoded.userId 
      ? `user_auth_${decoded.userId}` 
      : `user_auth_email_${(decoded.email || "").toLowerCase()}`;

    let user = await getCache(cacheKey);

    if (!user) {
      const query = decoded.userId ? { _id: decoded.userId } : { Email: decoded.email };
      user = await UserSignupSchemaDatas.findOne(query).select("-Password -verificationToken -__v");
      if (!user) return res.status(401).json({ message: "User not found" });
      
      // Store in memory cache for up to 10 minutes (600s)
      await setCache(cacheKey, user, 600);
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = authMiddleware;
