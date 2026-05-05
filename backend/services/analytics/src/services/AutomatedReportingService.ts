import { Db } from 'mongodb';
import { RedisClientType } from 'redis';
import { MetricsService } from './MetricsService';
import { ReportService } from './ReportService';
import { ReportType, ExportFormat, ReportSchedule, ReportFrequency } from '../types';
import nodemailer from 'nodemailer';

interface ReportRecipient {
  email: string;
  name: string;
  role: 'admin' | 'executive' | 'manager';
}

interface ScheduledReport {
  id: string;
  name: string;
  reportType: ReportType;
  frequency: ReportFrequency;
  recipients: ReportRecipient[];
  format: ExportFormat;
  isActive: boolean;
  lastRun?: Date;
  nextRun: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface BusinessSummary {
  period: { start: Date; end: Date };
  enrollment: {
    total: number;
    change: number;
    changePercent: number;
  };
  revenue: {
    total: number;
    change: number;
    changePercent: number;
    mrr: number;
    arr: number;
  };
  engagement: {
    dau: number;
    wau: number;
    mau: number;
    stickiness: number;
  };
  conversion: {
    overall: number;
    visitorToSignup: number;
    signupToEnrollment: number;
    paymentSuccess: number;
  };
  retention: {
    day1: number;
    day7: number;
    day30: number;
    churnRate: number;
  };
  topPrograms: Array<{
    name: string;
    enrollments: number;
    revenue: number;
  }>;
  alerts: Array<{
    severity: string;
    message: string;
    timestamp: Date;
  }>;
}

export class AutomatedReportingService {
  private metricsService: MetricsService;
  private reportService: ReportService;
  private emailTransporter: nodemailer.Transporter;

  constructor(
    private mongoDb: Db,
    private redisClient: RedisClientType,
    metricsService: MetricsService,
    reportService: ReportService
  ) {
    this.metricsService = metricsService;
    this.reportService = reportService;
    
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'apikey',
        pass: process.env.SMTP_PASSWORD || process.env.SENDGRID_API_KEY
      }
    });
  }

  // Schedule a new automated report
  async scheduleReport(
    name: string,
    reportType: ReportType,
    frequency: ReportFrequency,
    recipients: ReportRecipient[],
    format: ExportFormat = ExportFormat.PDF
  ): Promise<ScheduledReport> {
    const now = new Date();
    const scheduledReport: ScheduledReport = {
      id: `report_${Date.now()}`,
      name,
      reportType,
      frequency,
      recipients,
      format,
      isActive: true,
      nextRun: this.calculateNextRun(frequency, now),
      createdAt: now,
      updatedAt: now
    };

    await this.mongoDb.collection('scheduled_reports').insertOne(scheduledReport);
    
    // Store in Redis for quick access
    await this.redisClient.set(
      `scheduled_report:${scheduledReport.id}`,
      JSON.stringify(scheduledReport),
      { EX: 86400 * 7 } // 7 days expiry
    );

    return scheduledReport;
  }

  // Generate and send daily business summary
  async generateDailyBusinessSummary(): Promise<BusinessSummary> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch current metrics
    const [
      enrollmentMetrics,
      revenueMetrics,
      engagementMetrics,
      conversionFunnel
    ] = await Promise.all([
      this.metricsService.calculateEnrollmentMetrics(yesterday, now),
      this.metricsService.calculateRevenueMetrics(yesterday, now),
      this.metricsService.calculateEngagementMetrics(yesterday, now),
      this.metricsService.calculateConversionFunnel(yesterday, now)
    ]);

    // Fetch previous period for comparison
    const [prevEnrollmentMetrics, prevRevenueMetrics] = await Promise.all([
      this.metricsService.calculateEnrollmentMetrics(
        new Date(yesterday.getTime() - 24 * 60 * 60 * 1000),
        yesterday
      ),
      this.metricsService.calculateRevenueMetrics(
        new Date(yesterday.getTime() - 24 * 60 * 60 * 1000),
        yesterday
      )
    ]);

    // Calculate changes
    const totalEnrollments = enrollmentMetrics.reduce((sum, m) => sum + m.totalEnrollments, 0);
    const prevTotalEnrollments = prevEnrollmentMetrics.reduce((sum, m) => sum + m.totalEnrollments, 0);
    const enrollmentChange = totalEnrollments - prevTotalEnrollments;
    const enrollmentChangePercent = prevTotalEnrollments > 0
      ? (enrollmentChange / prevTotalEnrollments) * 100
      : 0;

    const revenueChange = revenueMetrics.totalRevenue - prevRevenueMetrics.totalRevenue;
    const revenueChangePercent = prevRevenueMetrics.totalRevenue > 0
      ? (revenueChange / prevRevenueMetrics.totalRevenue) * 100
      : 0;

    // Get MRR and ARR from Redis or calculate
    const mrr = await this.getMRR();
    const arr = mrr * 12;

    // Get retention metrics
    const retentionMetrics = await this.metricsService.calculateRetentionMetrics(lastWeek);
    const day1Retention = retentionMetrics.retentionByDay[0]?.retentionRate || 0;
    const day7Retention = retentionMetrics.retentionByWeek[0]?.retentionRate || 0;
    const day30Retention = retentionMetrics.retentionByMonth[0]?.retentionRate || 0;

    // Get churn rate
    const churnRate = await this.getChurnRate();

    // Get top programs
    const topPrograms = revenueMetrics.revenueByProgram
      .slice(0, 5)
      .map(p => ({
        name: p.programName,
        enrollments: p.enrollments,
        revenue: p.revenue
      }));

    // Get recent alerts
    const alerts = await this.getRecentAlerts(24);

    const summary: BusinessSummary = {
      period: { start: yesterday, end: now },
      enrollment: {
        total: totalEnrollments,
        change: enrollmentChange,
        changePercent: enrollmentChangePercent
      },
      revenue: {
        total: revenueMetrics.totalRevenue,
        change: revenueChange,
        changePercent: revenueChangePercent,
        mrr,
        arr
      },
      engagement: {
        dau: engagementMetrics.dailyActiveUsers,
        wau: engagementMetrics.weeklyActiveUsers,
        mau: engagementMetrics.monthlyActiveUsers,
        stickiness: (engagementMetrics.dailyActiveUsers / engagementMetrics.monthlyActiveUsers) * 100
      },
      conversion: {
        overall: conversionFunnel.conversionRates.overallConversion,
        visitorToSignup: conversionFunnel.conversionRates.visitorToSignup,
        signupToEnrollment: conversionFunnel.conversionRates.signupToEnrollment,
        paymentSuccess: conversionFunnel.conversionRates.paymentSuccess
      },
      retention: {
        day1: day1Retention,
        day7: day7Retention,
        day30: day30Retention,
        churnRate
      },
      topPrograms,
      alerts
    };

    // Store summary in MongoDB
    await this.mongoDb.collection('business_summaries').insertOne({
      ...summary,
      createdAt: now
    });

    return summary;
  }

  // Generate weekly performance report
  async generateWeeklyPerformanceReport(): Promise<string> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const report = await this.reportService.generateReport({
      reportType: ReportType.USER_ENGAGEMENT,
      startDate: weekAgo,
      endDate: now,
      format: ExportFormat.PDF
    });

    // Generate HTML report
    const html = this.generateWeeklyReportHTML(report);
    
    return html;
  }

  // Generate monthly executive dashboard
  async generateMonthlyExecutiveDashboard(): Promise<string> {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      enrollmentMetrics,
      revenueMetrics,
      engagementMetrics,
      conversionFunnel
    ] = await Promise.all([
      this.metricsService.calculateEnrollmentMetrics(monthAgo, now),
      this.metricsService.calculateRevenueMetrics(monthAgo, now),
      this.metricsService.calculateEngagementMetrics(monthAgo, now),
      this.metricsService.calculateConversionFunnel(monthAgo, now)
    ]);

    const html = this.generateExecutiveDashboardHTML({
      enrollmentMetrics,
      revenueMetrics,
      engagementMetrics,
      conversionFunnel,
      period: { start: monthAgo, end: now }
    });

    return html;
  }

  // Send daily business summary email
  async sendDailyBusinessSummary(recipients: ReportRecipient[]): Promise<void> {
    const summary = await this.generateDailyBusinessSummary();
    const html = this.generateDailySummaryHTML(summary);

    const emailPromises = recipients.map(recipient =>
      this.emailTransporter.sendMail({
        from: process.env.REPORT_FROM_EMAIL || 'reports@sai-mahendra.com',
        to: recipient.email,
        subject: `Daily Business Summary - ${summary.period.end.toLocaleDateString()}`,
        html
      })
    );

    await Promise.all(emailPromises);
  }

  // Send weekly performance report
  async sendWeeklyPerformanceReport(recipients: ReportRecipient[]): Promise<void> {
    const html = await this.generateWeeklyPerformanceReport();

    const emailPromises = recipients.map(recipient =>
      this.emailTransporter.sendMail({
        from: process.env.REPORT_FROM_EMAIL || 'reports@sai-mahendra.com',
        to: recipient.email,
        subject: `Weekly Performance Report - ${new Date().toLocaleDateString()}`,
        html
      })
    );

    await Promise.all(emailPromises);
  }

  // Send monthly executive dashboard
  async sendMonthlyExecutiveDashboard(recipients: ReportRecipient[]): Promise<void> {
    const html = await this.generateMonthlyExecutiveDashboard();

    const emailPromises = recipients.map(recipient =>
      this.emailTransporter.sendMail({
        from: process.env.REPORT_FROM_EMAIL || 'reports@sai-mahendra.com',
        to: recipient.email,
        subject: `Monthly Executive Dashboard - ${new Date().toLocaleDateString()}`,
        html
      })
    );

    await Promise.all(emailPromises);
  }

  // Process scheduled reports (called by cron job)
  async processScheduledReports(): Promise<void> {
    const now = new Date();
    
    const dueReports = await this.mongoDb.collection('scheduled_reports')
      .find({
        isActive: true,
        nextRun: { $lte: now }
      })
      .toArray();

    for (const report of dueReports) {
      try {
        await this.executeScheduledReport(report as ScheduledReport);
        
        // Update next run time
        await this.mongoDb.collection('scheduled_reports').updateOne(
          { id: report.id },
          {
            $set: {
              lastRun: now,
              nextRun: this.calculateNextRun(report.frequency, now),
              updatedAt: now
            }
          }
        );
      } catch (error) {
        console.error(`Failed to execute scheduled report ${report.id}:`, error);
        
        // Log error
        await this.mongoDb.collection('report_errors').insertOne({
          reportId: report.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: now
        });
      }
    }
  }

  // Execute a scheduled report
  private async executeScheduledReport(report: ScheduledReport): Promise<void> {
    const now = new Date();
    const startDate = this.getReportStartDate(report.frequency, now);

    const reportData = await this.reportService.generateReport({
      reportType: report.reportType,
      startDate,
      endDate: now,
      format: report.format
    });

    const html = this.generateReportHTML(report, reportData);

    // Send to recipients
    const emailPromises = report.recipients.map(recipient =>
      this.emailTransporter.sendMail({
        from: process.env.REPORT_FROM_EMAIL || 'reports@sai-mahendra.com',
        to: recipient.email,
        subject: `${report.name} - ${now.toLocaleDateString()}`,
        html
      })
    );

    await Promise.all(emailPromises);
  }

  // Helper: Calculate next run time
  private calculateNextRun(frequency: ReportFrequency, from: Date): Date {
    const next = new Date(from);
    
    switch (frequency) {
      case ReportFrequency.DAILY:
        next.setDate(next.getDate() + 1);
        next.setHours(8, 0, 0, 0); // 8 AM
        break;
      case ReportFrequency.WEEKLY:
        next.setDate(next.getDate() + 7);
        next.setHours(8, 0, 0, 0); // Monday 8 AM
        break;
      case ReportFrequency.MONTHLY:
        next.setMonth(next.getMonth() + 1);
        next.setDate(1);
        next.setHours(8, 0, 0, 0); // 1st of month, 8 AM
        break;
    }
    
    return next;
  }

  // Helper: Get report start date based on frequency
  private getReportStartDate(frequency: ReportFrequency, endDate: Date): Date {
    const start = new Date(endDate);
    
    switch (frequency) {
      case ReportFrequency.DAILY:
        start.setDate(start.getDate() - 1);
        break;
      case ReportFrequency.WEEKLY:
        start.setDate(start.getDate() - 7);
        break;
      case ReportFrequency.MONTHLY:
        start.setMonth(start.getMonth() - 1);
        break;
    }
    
    return start;
  }

  // Helper: Get MRR from cache or calculate
  private async getMRR(): Promise<number> {
    const cached = await this.redisClient.get('business:mrr:current');
    if (cached) {
      return parseFloat(cached);
    }
    
    // Calculate from subscriptions
    const subscriptions = await this.mongoDb.collection('subscriptions')
      .find({ status: 'active' })
      .toArray();
    
    const mrr = subscriptions.reduce((sum, sub) => sum + (sub.monthlyAmount || 0), 0);
    
    // Cache for 1 hour
    await this.redisClient.set('business:mrr:current', mrr.toString(), { EX: 3600 });
    
    return mrr;
  }

  // Helper: Get churn rate
  private async getChurnRate(): Promise<number> {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const [cancellations, activeSubscriptions] = await Promise.all([
      this.mongoDb.collection('events').countDocuments({
        eventType: 'SUBSCRIPTION_CANCELLED',
        timestamp: { $gte: monthAgo, $lte: now }
      }),
      this.mongoDb.collection('subscriptions').countDocuments({
        status: 'active',
        createdAt: { $lte: monthAgo }
      })
    ]);
    
    return activeSubscriptions > 0 ? (cancellations / activeSubscriptions) * 100 : 0;
  }

  // Helper: Get recent alerts
  private async getRecentAlerts(hours: number): Promise<Array<{ severity: string; message: string; timestamp: Date }>> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const alerts = await this.mongoDb.collection('alerts')
      .find({
        timestamp: { $gte: since },
        resolved: { $ne: true }
      })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
    
    return alerts.map(alert => ({
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.timestamp
    }));
  }

  // HTML generation methods
  private generateDailySummaryHTML(summary: BusinessSummary): string {
    const changeIcon = (change: number) => change >= 0 ? '📈' : '📉';
    const changeColor = (change: number) => change >= 0 ? '#10b981' : '#ef4444';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
    .metric-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
    .metric-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; }
    .metric-value { font-size: 32px; font-weight: bold; margin: 10px 0; }
    .metric-change { font-size: 14px; margin-top: 5px; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 20px; font-weight: bold; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 5px; }
    .alert { padding: 10px; margin: 5px 0; border-radius: 5px; }
    .alert-warning { background: #fef3c7; border-left: 4px solid #f59e0b; }
    .alert-critical { background: #fee2e2; border-left: 4px solid #ef4444; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Daily Business Summary</h1>
      <p>${summary.period.end.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>

    <div class="metric-grid">
      <div class="metric-card">
        <div>Enrollments</div>
        <div class="metric-value">${summary.enrollment.total}</div>
        <div class="metric-change" style="color: ${changeColor(summary.enrollment.change)}">
          ${changeIcon(summary.enrollment.change)} ${summary.enrollment.change >= 0 ? '+' : ''}${summary.enrollment.change} (${summary.enrollment.changePercent.toFixed(1)}%)
        </div>
      </div>

      <div class="metric-card">
        <div>Revenue</div>
        <div class="metric-value">₹${summary.revenue.total.toLocaleString()}</div>
        <div class="metric-change" style="color: ${changeColor(summary.revenue.change)}">
          ${changeIcon(summary.revenue.change)} ${summary.revenue.change >= 0 ? '+' : ''}₹${summary.revenue.change.toLocaleString()} (${summary.revenue.changePercent.toFixed(1)}%)
        </div>
      </div>

      <div class="metric-card">
        <div>Daily Active Users</div>
        <div class="metric-value">${summary.engagement.dau}</div>
        <div class="metric-change">Stickiness: ${summary.engagement.stickiness.toFixed(1)}%</div>
      </div>

      <div class="metric-card">
        <div>Conversion Rate</div>
        <div class="metric-value">${summary.conversion.overall.toFixed(2)}%</div>
        <div class="metric-change">Payment Success: ${summary.conversion.paymentSuccess.toFixed(1)}%</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">💰 Revenue Metrics</div>
      <table>
        <tr>
          <td><strong>MRR</strong></td>
          <td>₹${summary.revenue.mrr.toLocaleString()}</td>
        </tr>
        <tr>
          <td><strong>ARR</strong></td>
          <td>₹${summary.revenue.arr.toLocaleString()}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="section-title">🎯 Top Programs</div>
      <table>
        <thead>
          <tr>
            <th>Program</th>
            <th>Enrollments</th>
            <th>Revenue</th>
          </tr>
        </thead>
        <tbody>
          ${summary.topPrograms.map(p => `
            <tr>
              <td>${p.name}</td>
              <td>${p.enrollments}</td>
              <td>₹${p.revenue.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    ${summary.alerts.length > 0 ? `
      <div class="section">
        <div class="section-title">⚠️ Active Alerts</div>
        ${summary.alerts.map(alert => `
          <div class="alert alert-${alert.severity === 'critical' ? 'critical' : 'warning'}">
            <strong>${alert.severity.toUpperCase()}</strong>: ${alert.message}
          </div>
        `).join('')}
      </div>
    ` : ''}

    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
      <p>Sai Mahendra Platform - Automated Business Reporting</p>
      <p>Generated at ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private generateWeeklyReportHTML(report: any): string {
    // Simplified weekly report HTML
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #667eea; }
    .metric { background: #f9fafb; padding: 15px; margin: 10px 0; border-radius: 5px; }
  </style>
</head>
<body>
  <h1>📈 Weekly Performance Report</h1>
  <p>Week ending: ${new Date().toLocaleDateString()}</p>
  <div class="metric">
    <h3>User Engagement</h3>
    <p>Detailed metrics and analysis...</p>
  </div>
</body>
</html>
    `;
  }

  private generateExecutiveDashboardHTML(data: any): string {
    // Simplified executive dashboard HTML
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1000px; margin: 0 auto; padding: 20px; }
    h1 { color: #667eea; }
    .dashboard-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .dashboard-card { background: #f9fafb; padding: 20px; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>📊 Monthly Executive Dashboard</h1>
  <p>Month: ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
  <div class="dashboard-grid">
    <div class="dashboard-card">
      <h3>Enrollments</h3>
      <p>Comprehensive enrollment analysis...</p>
    </div>
    <div class="dashboard-card">
      <h3>Revenue</h3>
      <p>Revenue breakdown and trends...</p>
    </div>
    <div class="dashboard-card">
      <h3>Engagement</h3>
      <p>User engagement metrics...</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private generateReportHTML(report: ScheduledReport, data: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #667eea; }
  </style>
</head>
<body>
  <h1>${report.name}</h1>
  <p>Generated: ${new Date().toLocaleString()}</p>
  <pre>${JSON.stringify(data, null, 2)}</pre>
</body>
</html>
    `;
  }
}
