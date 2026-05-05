import nodemailer from 'nodemailer';
import { Logger } from '@sai-mahendra/utils';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailVerificationData {
  firstName: string;
  verificationToken: string;
  verificationUrl: string;
}

export interface PasswordResetData {
  firstName: string;
  resetToken: string;
  resetUrl: string;
}

export class EmailService {
  private static transporter: nodemailer.Transporter;

  /**
   * Initialize email transporter
   */
  static initialize(): void {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      });

      // Verify connection configuration
      this.transporter.verify((error, success) => {
        if (error) {
          Logger.error('Email service configuration error', error);
        } else {
          Logger.info('Email service is ready to send messages');
        }
      });
    }
  }

  /**
   * Send email
   */
  static async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      this.initialize();

      const mailOptions = {
        from: `${process.env.FROM_NAME || 'Sai Mahendra Platform'} <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      Logger.info('Email sent successfully', {
        messageId: info.messageId,
        to: options.to,
        subject: options.subject
      });

      return true;
    } catch (error) {
      Logger.error('Failed to send email', error as Error, {
        to: options.to,
        subject: options.subject
      });
      return false;
    }
  }

  /**
   * Send email verification email
   */
  static async sendEmailVerification(email: string, data: EmailVerificationData): Promise<boolean> {
    const subject = 'Verify Your Email - Sai Mahendra Platform';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .token { background: #e9ecef; padding: 15px; border-radius: 5px; font-family: monospace; word-break: break-all; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Sai Mahendra Platform!</h1>
          </div>
          <div class="content">
            <h2>Hi ${data.firstName},</h2>
            <p>Thank you for registering with Sai Mahendra Platform. To complete your registration and start your learning journey, please verify your email address.</p>
            
            <p><strong>Click the button below to verify your email:</strong></p>
            <a href="${data.verificationUrl}" class="button">Verify Email Address</a>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <div class="token">${data.verificationUrl}</div>
            
            <p><strong>Important:</strong> This verification link will expire in 24 hours for security reasons.</p>
            
            <p>If you didn't create an account with us, please ignore this email.</p>
            
            <p>Best regards,<br>The Sai Mahendra Platform Team</p>
          </div>
          <div class="footer">
            <p>© 2024 Sai Mahendra Platform. All rights reserved.</p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Welcome to Sai Mahendra Platform!
      
      Hi ${data.firstName},
      
      Thank you for registering with Sai Mahendra Platform. To complete your registration, please verify your email address by visiting:
      
      ${data.verificationUrl}
      
      This verification link will expire in 24 hours.
      
      If you didn't create an account with us, please ignore this email.
      
      Best regards,
      The Sai Mahendra Platform Team
    `;

    return this.sendEmail({ to: email, subject, html, text });
  }

  /**
   * Send password reset email
   */
  static async sendPasswordReset(email: string, data: PasswordResetData): Promise<boolean> {
    const subject = 'Reset Your Password - Sai Mahendra Platform';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .token { background: #e9ecef; padding: 15px; border-radius: 5px; font-family: monospace; word-break: break-all; margin: 15px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hi ${data.firstName},</h2>
            <p>We received a request to reset your password for your Sai Mahendra Platform account.</p>
            
            <p><strong>Click the button below to reset your password:</strong></p>
            <a href="${data.resetUrl}" class="button">Reset Password</a>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <div class="token">${data.resetUrl}</div>
            
            <div class="warning">
              <strong>Security Notice:</strong>
              <ul>
                <li>This password reset link will expire in 1 hour</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Your password will remain unchanged until you create a new one</li>
              </ul>
            </div>
            
            <p>If you continue to have problems, please contact our support team.</p>
            
            <p>Best regards,<br>The Sai Mahendra Platform Team</p>
          </div>
          <div class="footer">
            <p>© 2024 Sai Mahendra Platform. All rights reserved.</p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Password Reset Request - Sai Mahendra Platform
      
      Hi ${data.firstName},
      
      We received a request to reset your password for your Sai Mahendra Platform account.
      
      To reset your password, visit:
      ${data.resetUrl}
      
      This password reset link will expire in 1 hour.
      
      If you didn't request this reset, please ignore this email. Your password will remain unchanged.
      
      Best regards,
      The Sai Mahendra Platform Team
    `;

    return this.sendEmail({ to: email, subject, html, text });
  }

  /**
   * Send welcome email after email verification
   */
  static async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
    const subject = 'Welcome to Sai Mahendra Platform!';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #667eea; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Sai Mahendra Platform!</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName},</h2>
            <p>Congratulations! Your email has been verified and your account is now active. You're all set to begin your learning journey with us.</p>
            
            <h3>What's Next?</h3>
            
            <div class="feature">
              <h4>🚀 Explore Our Programs</h4>
              <p>Browse our comprehensive AI and Full Stack development programs designed for all skill levels.</p>
            </div>
            
            <div class="feature">
              <h4>💡 Start Learning</h4>
              <p>Access high-quality content, live sessions, and hands-on projects to accelerate your career.</p>
            </div>
            
            <div class="feature">
              <h4>🤝 Join the Community</h4>
              <p>Connect with fellow learners, mentors, and industry experts in our vibrant community.</p>
            </div>
            
            <a href="${process.env.FRONTEND_URL || 'https://saimahendra.com'}/dashboard" class="button">Go to Dashboard</a>
            
            <p>If you have any questions or need assistance, our support team is here to help!</p>
            
            <p>Happy learning!<br>The Sai Mahendra Platform Team</p>
          </div>
          <div class="footer">
            <p>© 2024 Sai Mahendra Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Welcome to Sai Mahendra Platform!
      
      Hi ${firstName},
      
      Congratulations! Your email has been verified and your account is now active.
      
      What's Next?
      - Explore our AI and Full Stack development programs
      - Start learning with high-quality content and live sessions
      - Join our vibrant learning community
      
      Visit your dashboard: ${process.env.FRONTEND_URL || 'https://saimahendra.com'}/dashboard
      
      Happy learning!
      The Sai Mahendra Platform Team
    `;

    return this.sendEmail({ to: email, subject, html, text });
  }

  /**
   * Send password change confirmation email
   */
  static async sendPasswordChangeConfirmation(email: string, firstName: string): Promise<boolean> {
    const subject = 'Password Changed Successfully - Sai Mahendra Platform';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Changed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .security-notice { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Password Changed Successfully</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName},</h2>
            <p>This email confirms that your password has been successfully changed for your Sai Mahendra Platform account.</p>
            
            <div class="security-notice">
              <strong>Security Information:</strong>
              <ul>
                <li>Change made on: ${new Date().toLocaleString()}</li>
                <li>All existing sessions have been terminated</li>
                <li>You'll need to log in again with your new password</li>
              </ul>
            </div>
            
            <p><strong>If you didn't make this change:</strong></p>
            <p>Please contact our support team immediately at support@saimahendra.com or through our help center.</p>
            
            <p>For your security, we recommend:</p>
            <ul>
              <li>Using a strong, unique password</li>
              <li>Enabling two-factor authentication (coming soon)</li>
              <li>Regularly reviewing your account activity</li>
            </ul>
            
            <p>Thank you for keeping your account secure!</p>
            
            <p>Best regards,<br>The Sai Mahendra Platform Team</p>
          </div>
          <div class="footer">
            <p>© 2024 Sai Mahendra Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Password Changed Successfully - Sai Mahendra Platform
      
      Hi ${firstName},
      
      This email confirms that your password has been successfully changed for your Sai Mahendra Platform account.
      
      Change made on: ${new Date().toLocaleString()}
      All existing sessions have been terminated.
      
      If you didn't make this change, please contact support immediately at support@saimahendra.com
      
      Best regards,
      The Sai Mahendra Platform Team
    `;

    return this.sendEmail({ to: email, subject, html, text });
  }

  /**
   * Send account linking request email
   */
  static async sendAccountLinkingRequest(
    email: string,
    firstName: string,
    provider: string,
    verificationToken: string
  ): Promise<boolean> {
    const subject = `Link Your ${provider.charAt(0).toUpperCase() + provider.slice(1)} Account - Sai Mahendra Platform`;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const linkingUrl = `${frontendUrl}/link-account?token=${verificationToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Link Social Account</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .token { background: #e9ecef; padding: 15px; border-radius: 5px; font-family: monospace; word-break: break-all; margin: 15px 0; }
          .info-box { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔗 Link Your ${provider.charAt(0).toUpperCase() + provider.slice(1)} Account</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName},</h2>
            <p>We noticed you tried to sign in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}, but an account with this email already exists on Sai Mahendra Platform.</p>
            
            <div class="info-box">
              <strong>What does this mean?</strong>
              <p>You can link your ${provider.charAt(0).toUpperCase() + provider.slice(1)} account to your existing account, allowing you to sign in using either method in the future.</p>
            </div>
            
            <p><strong>Click the button below to confirm and link your accounts:</strong></p>
            <a href="${linkingUrl}" class="button">Link ${provider.charAt(0).toUpperCase() + provider.slice(1)} Account</a>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <div class="token">${linkingUrl}</div>
            
            <p><strong>Important:</strong> This linking request will expire in 1 hour for security reasons.</p>
            
            <p>If you didn't attempt to sign in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}, please ignore this email and consider changing your password.</p>
            
            <p>Best regards,<br>The Sai Mahendra Platform Team</p>
          </div>
          <div class="footer">
            <p>© 2024 Sai Mahendra Platform. All rights reserved.</p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Link Your ${provider.charAt(0).toUpperCase() + provider.slice(1)} Account - Sai Mahendra Platform
      
      Hi ${firstName},
      
      We noticed you tried to sign in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}, but an account with this email already exists.
      
      You can link your ${provider.charAt(0).toUpperCase() + provider.slice(1)} account to your existing account by visiting:
      
      ${linkingUrl}
      
      This linking request will expire in 1 hour.
      
      If you didn't attempt to sign in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}, please ignore this email.
      
      Best regards,
      The Sai Mahendra Platform Team
    `;

    return this.sendEmail({ to: email, subject, html, text });
  }
}