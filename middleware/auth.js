const jwt = require('jsonwebtoken');
const { UserSignupSchemaDatas } = require('../models/webmodel');

// Authentication middleware - checks Authorization header for Bearer token
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Prefer userId if present in token, fallback to email
    const query = decoded.userId ? { _id: decoded.userId } : { Email: decoded.email };

    const user = await UserSignupSchemaDatas.findOne(query).select('-Password -verificationToken -__v');
    if (!user) return res.status(401).json({ message: 'User not found for provided token' });

    req.user = user; // attach user doc to request
    return next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ message: 'Server error in auth middleware' });
  }
};

module.exports = authMiddleware;
