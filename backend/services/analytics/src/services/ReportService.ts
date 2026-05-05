import { Db } from 'mongodb';
import { MetricsService } from './MetricsService';
import { ReportType, ExportFormat, ReportExportRequest } from '../types';
import { createObjectCsvStringifier } from 'csv-writer';

export class ReportService {
  private metricsService: MetricsService;

  constructor(
    private mongoDb: Db,
    metricsService: MetricsService
  ) {
    this.metricsService = metricsService;
  }

  // Generate report based on type
  async generateReport(request: ReportExportRequest): Promise<any> {
    const { reportType, startDate, endDate, filters } = request;

    switch (reportType) {
      case ReportType.ENROLLMENT:
        return await this.metricsService.calculateEnrollmentMetrics(
          startDate,
          endDate,
          filters?.programId
        );

      case ReportType.REVENUE:
        return await this.metricsService.calculateRevenueMetrics(startDate, endDate);

      case ReportType.USER_ENGAGEMENT:
        return await this.metricsService.calculateEngagementMetrics(startDate, endDate);

      case ReportType.RETENTION:
        const cohortDate = filters?.cohortDate || startDate;
        return await this.metricsService.calculateRetentionMetrics(cohortDate);

      case ReportType.CONVERSION_FUNNEL:
        return await this.metricsService.calculateConversionFunnel(startDate, endDate);

      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }
  }

  // Export report in specified format
  async exportReport(request: ReportExportRequest): Promise<string> {
    const data = await this.generateReport(request);

    switch (request.format) {
      case ExportFormat.JSON:
        return JSON.stringify(data, null, 2);

      case ExportFormat.CSV:
        return this.convertToCSV(data, request.reportType);

      case ExportFormat.EXCEL:
        // For now, return CSV format (can be enhanced with actual Excel library)
        return this.convertToCSV(data, request.reportType);

      case ExportFormat.PDF:
        // Placeholder for PDF generation (would need a PDF library)
        throw new Error('PDF export not yet implemented');

      default:
        throw new Error(`Unsupported export format: ${request.format}`);
    }
  }

  // Convert data to CSV format
  private convertToCSV(data: any, reportType: ReportType): string {
    switch (reportType) {
      case ReportType.ENROLLMENT:
        return this.enrollmentMetricsToCSV(data);

      case ReportType.REVENUE:
        return this.revenueMetricsToCSV(data);

      case ReportType.USER_ENGAGEMENT:
        return this.engagementMetricsToCSV(data);

      case ReportType.RETENTION:
        return this.retentionMetricsToCSV(data);

      case ReportType.CONVERSION_FUNNEL:
        return this.conversionFunnelToCSV(data);

      default:
        return JSON.stringify(data);
    }
  }

  private enrollmentMetricsToCSV(metrics: any[]): string {
    if (!Array.isArray(metrics) || metrics.length === 0) {
      return 'No data available';
    }

    const headers = [
      'Program ID',
      'Program Name',
      'Total Enrollments',
      'Active Enrollments',
      'Completed Enrollments',
      'Average Completion Time (days)',
      'Completion Rate (%)'
    ];

    const rows = metrics.map(m => [
      m.programId,
      m.programName,
      m.totalEnrollments,
      m.activeEnrollments,
      m.completedEnrollments,
      m.averageCompletionTime.toFixed(2),
      m.completionRate.toFixed(2)
    ]);

    return this.arrayToCSV([headers, ...rows]);
  }

  private revenueMetricsToCSV(metrics: any): string {
    const summary = [
      ['Metric', 'Value'],
      ['Total Revenue', metrics.totalRevenue],
      ['Transaction Count', metrics.transactionCount],
      ['Average Order Value', metrics.averageOrderValue.toFixed(2)],
      [''],
      ['Revenue by Program'],
      ['Program ID', 'Program Name', 'Revenue', 'Enrollments']
    ];

    const programRows = metrics.revenueByProgram.map((p: any) => [
      p.programId,
      p.programName,
      p.revenue,
      p.enrollments
    ]);

    const gatewaySection = [
      [''],
      ['Revenue by Gateway'],
      ['Gateway', 'Revenue', 'Transactions', 'Success Rate (%)']
    ];

    const gatewayRows = metrics.revenueByGateway.map((g: any) => [
      g.gateway,
      g.revenue,
      g.transactionCount,
      g.successRate.toFixed(2)
    ]);

    return this.arrayToCSV([...summary, ...programRows, ...gatewaySection, ...gatewayRows]);
  }

  private engagementMetricsToCSV(metrics: any): string {
    const summary = [
      ['Metric', 'Value'],
      ['Daily Active Users', metrics.dailyActiveUsers],
      ['Weekly Active Users', metrics.weeklyActiveUsers],
      ['Monthly Active Users', metrics.monthlyActiveUsers],
      ['Average Session Duration (seconds)', metrics.averageSessionDuration.toFixed(2)],
      ['Average Page Views per Session', metrics.averagePageViewsPerSession.toFixed(2)],
      ['Bounce Rate (%)', metrics.bounceRate.toFixed(2)],
      [''],
      ['Top Pages'],
      ['Page', 'Views', 'Unique Visitors']
    ];

    const pageRows = metrics.topPages.map((p: any) => [
      p.page,
      p.views,
      p.uniqueVisitors
    ]);

    return this.arrayToCSV([...summary, ...pageRows]);
  }

  private retentionMetricsToCSV(metrics: any): string {
    const summary = [
      ['Cohort Date', metrics.cohortDate.toISOString().split('T')[0]],
      ['Total Users', metrics.totalUsers],
      [''],
      ['Daily Retention'],
      ['Day', 'Active Users', 'Retention Rate (%)']
    ];

    const dayRows = metrics.retentionByDay.map((r: any) => [
      r.period,
      r.activeUsers,
      r.retentionRate.toFixed(2)
    ]);

    const weekSection = [
      [''],
      ['Weekly Retention'],
      ['Week', 'Active Users', 'Retention Rate (%)']
    ];

    const weekRows = metrics.retentionByWeek.map((r: any) => [
      r.period,
      r.activeUsers,
      r.retentionRate.toFixed(2)
    ]);

    return this.arrayToCSV([...summary, ...dayRows, ...weekSection, ...weekRows]);
  }

  private conversionFunnelToCSV(funnel: any): string {
    const data = [
      ['Conversion Funnel Analysis'],
      [''],
      ['Stage', 'Count', 'Conversion Rate (%)'],
      ['Visitors', funnel.visitors, '100.00'],
      ['Signups', funnel.signups, funnel.conversionRates.visitorToSignup.toFixed(2)],
      ['Enrollment Starts', funnel.enrollmentStarts, funnel.conversionRates.signupToEnrollment.toFixed(2)],
      ['Payment Initiated', funnel.paymentInitiated, funnel.conversionRates.enrollmentToPayment.toFixed(2)],
      ['Payment Completed', funnel.paymentCompleted, funnel.conversionRates.paymentSuccess.toFixed(2)],
      [''],
      ['Overall Conversion Rate', funnel.conversionRates.overallConversion.toFixed(2) + '%']
    ];

    return this.arrayToCSV(data);
  }

  private arrayToCSV(data: any[][]): string {
    return data.map(row => 
      row.map(cell => {
        const cellStr = String(cell);
        // Escape quotes and wrap in quotes if contains comma or quote
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    ).join('\n');
  }

  // Schedule automated report generation
  async scheduleReport(
    reportType: ReportType,
    frequency: 'daily' | 'weekly' | 'monthly',
    recipients: string[]
  ): Promise<void> {
    // Store scheduled report configuration
    await this.mongoDb.collection('scheduled_reports').insertOne({
      reportType,
      frequency,
      recipients,
      isActive: true,
      createdAt: new Date(),
      lastRun: null,
      nextRun: this.calculateNextRun(frequency)
    });
  }

  private calculateNextRun(frequency: 'daily' | 'weekly' | 'monthly'): Date {
    const now = new Date();
    switch (frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth;
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }
}
