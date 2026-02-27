const nodemailer = require('nodemailer');

const createEmailTransporter = () => {
    return nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
};

const sendOtpEmail = async (user, otp) => {
    const transporter = createEmailTransporter();

    const mailOptions = {
        from: {
            name: 'AspirantCareer Team',
            address: process.env.EMAIL_USER
        },
        to: user.email,
        subject: "Your Verification OTP - AspirantCareer",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a73e8;">Welcome to AspirantCareer!</h2>
                <h3>Hello ${user.firstName},</h3>
                <p>Thank you for registering with AspirantCareer. Use the OTP below to verify your email address:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <div style="display: inline-block; background-color: #f0f4ff; border: 2px dashed #1a73e8;
                                padding: 20px 40px; border-radius: 8px;">
                        <p style="margin: 0 0 8px 0; color: #555; font-size: 14px;">Your OTP Code</p>
                        <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #1a73e8;">
                            ${otp}
                        </span>
                    </div>
                </div>
                <p style="color: #d32f2f; font-weight: bold;">This OTP will expire in 10 minutes.</p>
                <p>If you didn't create this account, please ignore this email.</p>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                    <p style="color: #666; font-size: 12px;">
                        This is an automated email, please do not reply.
                        If you need assistance, please contact our support team.
                    </p>
                </div>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('OTP email sending failed:', error);
        throw new Error('Failed to send OTP email');
    }
};

const sendPasswordResetOtpEmail = async (user, otp) => {
    const transporter = createEmailTransporter();

    const mailOptions = {
        from: {
            name: 'AspirantCareer Team',
            address: process.env.EMAIL_USER
        },
        to: user.email,
        subject: "Password Reset OTP - AspirantCareer",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #d32f2f;">Password Reset Request</h2>
                <h3>Hello ${user.firstName},</h3>
                <p>We received a request to reset your AspirantCareer account password. Use the OTP below to continue:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <div style="display: inline-block; background-color: #fff3f3; border: 2px dashed #d32f2f;
                                padding: 20px 40px; border-radius: 8px;">
                        <p style="margin: 0 0 8px 0; color: #555; font-size: 14px;">Password Reset OTP</p>
                        <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #d32f2f;">
                            ${otp}
                        </span>
                    </div>
                </div>
                <p style="color: #d32f2f; font-weight: bold;">This OTP will expire in 10 minutes.</p>
                <p>If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                    <p style="color: #666; font-size: 12px;">
                        This is an automated email, please do not reply.
                        If you need assistance, please contact our support team.
                    </p>
                </div>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Password reset OTP email sending failed:', error);
        throw new Error('Failed to send password reset OTP email');
    }
};

module.exports = { sendOtpEmail, sendPasswordResetOtpEmail };
