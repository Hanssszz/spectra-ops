import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  /** Lazily-created SMTP transporter — reuses the same connection. */
  private getTransporter() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'incident-alert':
        await this.handleIncidentAlert(job.data);
        break;

      case 'attendance-report':
        this.logger.log(`Generating attendance report for Site ID: ${job.data.siteId}`);
        // PDF generation / aggregate logic goes here
        break;

      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleIncidentAlert(data: {
    id: string;
    title: string;
    type: string;
    severity: string;
    siteName: string;
    reporterName: string;
    reportedAt: string;
  }) {
    this.logger.log(`Processing incident alert for Incident ID: ${data.id}`);

    const smtpUser = process.env.SMTP_USER;
    const alertRecipients = process.env.ALERT_EMAIL_RECIPIENTS;

    if (!smtpUser || !alertRecipients) {
      this.logger.warn(
        'SMTP_USER or ALERT_EMAIL_RECIPIENTS not configured — skipping email dispatch.',
      );
      return;
    }

    const transporter = this.getTransporter();

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e1b4b; padding: 24px; border-radius: 8px 8px 0 0;">
          <h2 style="color: #fff; margin: 0;">🚨 Spectra Incident Alert</h2>
        </div>
        <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #64748b; width: 120px;">Incident ID</td><td style="padding: 8px 0; font-weight: 600;">${data.id}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Title</td><td style="padding: 8px 0; font-weight: 600;">${data.title}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Type</td><td style="padding: 8px 0;">${data.type}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Severity</td><td style="padding: 8px 0; font-weight: 600; color: ${data.severity === 'CRITICAL' || data.severity === 'HIGH' ? '#dc2626' : '#f59e0b'};">${data.severity}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Site</td><td style="padding: 8px 0;">${data.siteName}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Reported By</td><td style="padding: 8px 0;">${data.reporterName}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;">Reported At</td><td style="padding: 8px 0;">${new Date(data.reportedAt).toLocaleString()}</td></tr>
          </table>
          <p style="margin-top: 16px; color: #64748b; font-size: 14px;">
            Log in to the Spectra Operations Platform to review and manage this incident.
          </p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Spectra Ops" <${smtpUser}>`,
        to: alertRecipients,
        subject: `[SPECTRA] ${data.severity} Incident: ${data.title} at ${data.siteName}`,
        html,
      });
      this.logger.log(`Incident alert email dispatched for Incident ID: ${data.id}`);
    } catch (err) {
      this.logger.error(`Failed to send incident alert email: ${(err as Error).message}`);
    }
  }
}
