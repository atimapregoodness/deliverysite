import nodemailer from "nodemailer";
import logger from "../utils/logger.js";

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(to, subject, html, text = null) {
    try {
      const mailOptions = {
        from: `"Delivery Tracker Pro" <${process.env.SMTP_FROM}>`,
        to,
        subject,
        html,
        text: text || this.htmlToText(html),
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${to}: ${subject}`);
      return result;
    } catch (error) {
      logger.error("Email sending failed:", error);
      throw error;
    }
  }

  htmlToText(html) {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<p>/gi, "\n")
      .replace(/<\/p>/gi, "")
      .replace(/<[^>]*>/g, "")
      .trim();
  }

  async sendDeliveryUpdate(delivery, updateType) {
    const subjectMap = {
      created: `Delivery Created - Tracking #${delivery.trackingCode}`,
      "status-updated": `Delivery Status Update - ${delivery.trackingCode}`,
      "out-for-delivery": `Your Package is Out for Delivery - ${delivery.trackingCode}`,
      delivered: `Delivery Completed - ${delivery.trackingCode}`,
    };

    const subject =
      subjectMap[updateType] || `Delivery Update - ${delivery.trackingCode}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3B82F6; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 5px; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          .tracking-code { font-size: 24px; font-weight: bold; color: #3B82F6; }
          .status { padding: 5px 10px; background: #EFF6FF; border-radius: 3px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Delivery Tracker Pro</h1>
          </div>
          <div class="content">
            <h2>${subject}</h2>
            <p>Hello ${delivery.recipient.name},</p>
            
            <p>Your delivery with tracking code <span class="tracking-code">${
              delivery.trackingCode
            }</span> has been updated.</p>
            
            <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Current Status:</strong> <span class="status">${
                delivery.currentStatus
              }</span></p>
              <p><strong>Estimated Delivery:</strong> ${new Date(
                delivery.estimatedDelivery
              ).toLocaleDateString()}</p>
              <p><strong>Recipient:</strong> ${delivery.recipient.name}</p>
              <p><strong>Delivery Address:</strong> ${
                delivery.recipient.address.street
              }, ${delivery.recipient.address.city}</p>
            </div>

            <p>You can track your delivery in real-time using the following link:</p>
            <p>
              <a href="${process.env.BASE_URL}/track/${delivery.trackingCode}" 
                 style="background: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Track Your Delivery
              </a>
            </p>

            <p>If you have any questions, please contact our support team.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Delivery Tracker Pro. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(delivery.recipient.email, subject, html);
  }

  async sendBreakdownAlert(delivery, breakdown) {
    const subject = `🚨 Delivery Breakdown Alert - ${delivery.trackingCode}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #EF4444; color: white; padding: 20px; text-align: center; }
          .alert { background: #FEF2F2; border: 1px solid #FECACA; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 Delivery Breakdown Alert</h1>
          </div>
          
          <div class="alert">
            <h2>Important Delivery Update</h2>
            <p>Your delivery with tracking code <strong>${
              delivery.trackingCode
            }</strong> has experienced a breakdown.</p>
          </div>

          <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Breakdown Type:</strong> ${breakdown.type}</p>
            <p><strong>Description:</strong> ${breakdown.description}</p>
            <p><strong>Severity:</strong> ${breakdown.severity}</p>
            <p><strong>Location:</strong> ${
              breakdown.location?.name || "Unknown location"
            }</p>
            <p><strong>Time Reported:</strong> ${new Date(
              breakdown.timestamp
            ).toLocaleString()}</p>
          </div>

          <p>Our team is working to resolve this issue as quickly as possible. We apologize for any inconvenience caused.</p>

          <p>
            <a href="${process.env.BASE_URL}/track/${delivery.trackingCode}" 
               style="background: #EF4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              View Delivery Details
            </a>
          </p>

          <p>We will keep you updated on the progress. Thank you for your patience.</p>
        </div>
        
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Delivery Tracker Pro. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(delivery.recipient.email, subject, html);
  }

  async sendWelcomeEmail(user) {
    const subject = "Welcome to Delivery Tracker Pro!";

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Delivery Tracker Pro! 🎉</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 20px; border-radius: 5px;">
            <p>Hello ${user.profile?.firstName || user.username},</p>
            
            <p>Thank you for joining Delivery Tracker Pro! We're excited to have you on board.</p>
            
            <p>With our platform, you can:</p>
            <ul>
              <li>Track deliveries in real-time with live maps</li>
              <li>Receive instant notifications about delivery status</li>
              <li>Get breakdown alerts with detailed information</li>
              <li>Manage multiple deliveries efficiently</li>
            </ul>

            <p>
              <a href="${process.env.BASE_URL}/track" 
                 style="background: #10B981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Start Tracking
              </a>
            </p>

            <p>If you have any questions, feel free to contact our support team.</p>
          </div>
        </div>
        
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Delivery Tracker Pro. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(user.email, subject, html);
  }

  async sendStatusNotification(delivery, oldStatus, newStatus) {
    const subject = `Delivery Status Changed - ${delivery.trackingCode}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #8B5CF6; color: white; padding: 20px; text-align: center; }
          .status-change { background: #FAF5FF; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Delivery Status Update</h1>
          </div>
          
          <div class="status-change">
            <p>Your delivery status has changed from <strong>${oldStatus}</strong> to <strong>${newStatus}</strong>.</p>
          </div>

          <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Tracking Code:</strong> ${delivery.trackingCode}</p>
            <p><strong>Recipient:</strong> ${delivery.recipient.name}</p>
            <p><strong>Current Status:</strong> ${newStatus}</p>
            <p><strong>Updated:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <p>
            <a href="${process.env.BASE_URL}/track/${delivery.trackingCode}" 
               style="background: #8B5CF6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              View Delivery Details
            </a>
          </p>

          <p>Thank you for using Delivery Tracker Pro!</p>
        </div>
        
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Delivery Tracker Pro. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(delivery.recipient.email, subject, html);
  }
}

export default new EmailService();
