const nodemailer = require('nodemailer');

const createEmailTransporter = () => {
    return nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        tls: {
            rejectUnauthorized: false // For development only, remove in production
        }
    });
};

const sendVerificationEmail = async (user, verificationToken) => {
    const transporter = createEmailTransporter();
    const verifyUrl = `${process.env.FRONTEND_URL}/verify?token=${verificationToken}`;

    const mailOptions = {
        from: {
            name: 'JobSarthi Team',
            address: process.env.EMAIL_USER
        },
        to: user.Email,
        subject: "Verify Your Email - JobSarthi",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a73e8;">Welcome to JobSarthi!</h2>
                <h3>Hello ${user.FirstName},</h3>
                <p>Thank you for registering with JobSarthi. To complete your registration, please verify your email address by clicking the button below:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${verifyUrl}" 
                       style="background-color: #1a73e8; 
                              color: white; 
                              padding: 12px 24px; 
                              text-decoration: none; 
                              border-radius: 4px;
                              display: inline-block;">
                        Verify Email
                    </a>
                </div>
                <p>This verification link will expire in 24 hours.</p>
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
        console.error('Email sending failed:', error);
        throw new Error('Failed to send verification email');
    }
};

module.exports = { sendVerificationEmail };