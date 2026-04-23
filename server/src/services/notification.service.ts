/**
 * Notification Service
 * Abstraction layer for email, WhatsApp, and SMS alerts.
 * Each provider is a no-op until credentials are configured in settings.
 */
import logger from '../utils/logger';
import { AlarmSeverity, NotificationPayload } from '../types';

class NotificationService {
  async send(severity: AlarmSeverity, message: string, tagName: string): Promise<void> {
    const payload: NotificationPayload = { severity, message, tagName, timestamp: new Date().toISOString() };

    await Promise.allSettled([
      this._sendEmail(payload),
      this._sendWhatsApp(payload),
      this._sendSms(payload),
    ]);
  }

  private async _sendEmail({ severity, tagName }: NotificationPayload): Promise<void> {
    // TODO: load settings from DB, use nodemailer when SMTP configured
    logger.debug('Email notification (not configured)', { severity, tagName });
  }

  private async _sendWhatsApp({ severity, tagName }: NotificationPayload): Promise<void> {
    // TODO: integrate WhatsApp Business API when configured
    logger.debug('WhatsApp notification (not configured)', { severity, tagName });
  }

  private async _sendSms({ severity, tagName }: NotificationPayload): Promise<void> {
    // TODO: integrate Twilio SDK when configured
    logger.debug('SMS notification (not configured)', { severity, tagName });
  }
}

export default new NotificationService();
