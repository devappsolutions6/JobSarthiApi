const rateLimit = require('express-rate-limit');

// Signup rate limiter: prevent brute force account creation
const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 40, // limit each IP to 5 signup requests per window
    message: 'Too many accounts created from this IP, please try again after an hour',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Login rate limiter: tighter window, more attempts allowed
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 40, // limit each IP to 10 login requests per window
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

module.exports = { signupLimiter, loginLimiter };
