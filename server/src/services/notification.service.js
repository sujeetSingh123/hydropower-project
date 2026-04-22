/**
 * Notification Service
 * Abstraction layer for email, WhatsApp, and SMS alerts.
 * Each provider is a no-op until credentials are configured in settings.
 */
const logger = require('../utils/logger');

class NotificationService {
  async send(severity, message, tagName) {
    const payload = { severity, message, tagName, timestamp: new Date().toISOString() };

    await Promise.allSettled([
      this._sendEmail(payload),
      this._sendWhatsApp(payload),
      this._sendSms(payload),
    ]);
  }

  async _sendEmail({ severity, message, tagName, timestamp }) {
    // TODO: load settings from DB, use nodemailer when SMTP configured
    logger.debug('Email notification (not configured)', { severity, tagName });
  }

  async _sendWhatsApp({ severity, message, tagName }) {
    // TODO: integrate WhatsApp Business API when configured
    logger.debug('WhatsApp notification (not configured)', { severity, tagName });
  }

  async _sendSms({ severity, message, tagName }) {
    // TODO: integrate Twilio SDK when configured
    logger.debug('SMS notification (not configured)', { severity, tagName });
  }
}

module.exports = new NotificationService();
