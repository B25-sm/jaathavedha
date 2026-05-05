import { Db } from 'mongodb';
import { RedisClientType } from 'redis';
import { Alert, AlertType, AlertSeverity } from '../types';
import winston from 'winston';

export interface AlertThreshold {
  metric: string;
  condition: 'above' | 'below';
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
}

export class AlertService {
  private logger: winston.Logger;

  constructor(
    private mongoDb: Db,
    private redisClient: RedisClientType,
    logger: winston.Logger
  ) {
    this.logger = logger;
  }

  // Check metrics against thresholds and create alerts
  async checkThresholds(): Promise<Alert[]> {
    const thresholds = await this.getActiveThresholds();
    const alerts: Alert[] = [];

    for (const threshold of thresholds) {
      const currentValue = await this.getMetricValue(threshold.metric);
      
      if (this.shouldAlert(currentValue, threshold)) {
        const alert = await this.createAlert({
          type: AlertType.METRIC_THRESHOLD,
          severity: threshold.severity,
          message: this.generateAlertMessage(threshold, currentValue),
          metric: threshold.metric,
          threshold: threshold.threshold,
          currentValue,
          timestamp: new Date()
        });
        
        alerts.push(alert);
      }
    }

    return alerts;
  }

  private shouldAlert(currentValue: number, threshold: AlertThreshold): boolean {
    if (threshold.condition === 'above') {
      return currentValue > threshold.threshold;
    } else {
      return currentValue < threshold.threshold;
    }
  }

  private generateAlertMessage(threshold: AlertThreshold, currentValue: number): string {
    const condition = threshold.condition === 'above' ? 'exceeded' : 'fallen below';
    return `${threshold.metric} has ${condition} threshold: ${currentValue} (threshold: ${threshold.threshold})`;
  }

  // Create and store alert
  async createAlert(alertData: Omit<Alert, 'id'>): Promise<Alert> {
    const alert: Alert = {
      id: new Date().getTime().toString(),
      ...alertData
    };

    // Store in MongoDB
    await this.mongoDb.collection('alerts').insertOne(alert);

    // Store in Redis for real-time access
    await this.redisClient.lPush('alerts:active', JSON.stringify(alert));
    await this.redisClient.lTrim('alerts:active', 0, 99); // Keep last 100 alerts

    this.logger.warn('Alert created', alert);

    return alert;
  }

  // Get active alerts
  async getActiveAlerts(limit: number = 50): Promise<Alert[]> {
    const alerts = await this.mongoDb.collection('alerts')
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return alerts.map(a => ({
      id: a._id.toString(),
      type: a.type,
      severity: a.severity,
      message: a.message,
      metric: a.metric,
      threshold: a.threshold,
      currentValue: a.currentValue,
      timestamp: a.timestamp
    }));
  }

  // Get metric value for threshold checking
  private async getMetricValue(metric: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    switch (metric) {
      case 'daily_active_users':
        const dau = await this.redisClient.sCard(`analytics:active_users:${today}`);
        return dau;

      case 'daily_revenue':
        const revenueEvents = await this.mongoDb.collection('events').aggregate([
          {
            $match: {
              eventType: 'payment_completed',
              timestamp: {
                $gte: new Date(today),
                $lt: new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000)
              }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$properties.amount' }
            }
          }
        ]).toArray();
        return revenueEvents[0]?.total || 0;

      case 'daily_enrollments':
        const enrollments = await this.mongoDb.collection('events').countDocuments({
          eventType: 'enrollment_completed',
          timestamp: {
            $gte: new Date(today),
            $lt: new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000)
          }
        });
        return enrollments;

      case 'payment_failure_rate':
        const paymentStats = await this.mongoDb.collection('events').aggregate([
          {
            $match: {
              $or: [
                { eventType: 'payment_completed' },
                { eventType: 'payment_failed' }
              ],
              timestamp: {
                $gte: new Date(today),
                $lt: new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000)
              }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              failed: {
                $sum: {
                  $cond: [{ $eq: ['$eventType', 'payment_failed'] }, 1, 0]
                }
              }
            }
          }
        ]).toArray();
        
        const stats = paymentStats[0];
        if (!stats || stats.total === 0) return 0;
        return (stats.failed / stats.total) * 100;

      case 'error_rate':
        const errorCount = await this.redisClient.get(`analytics:errors:${today}`);
        return parseInt(errorCount || '0', 10);

      default:
        return 0;
    }
  }

  // Manage alert thresholds
  async getActiveThresholds(): Promise<AlertThreshold[]> {
    const thresholds = await this.mongoDb.collection('alert_thresholds')
      .find({ enabled: true })
      .toArray();

    return thresholds.map(t => ({
      metric: t.metric,
      condition: t.condition,
      threshold: t.threshold,
      severity: t.severity,
      enabled: t.enabled
    }));
  }

  async createThreshold(threshold: AlertThreshold): Promise<void> {
    await this.mongoDb.collection('alert_thresholds').insertOne({
      ...threshold,
      createdAt: new Date()
    });
  }

  async updateThreshold(metric: string, updates: Partial<AlertThreshold>): Promise<void> {
    await this.mongoDb.collection('alert_thresholds').updateOne(
      { metric },
      { $set: { ...updates, updatedAt: new Date() } }
    );
  }

  async deleteThreshold(metric: string): Promise<void> {
    await this.mongoDb.collection('alert_thresholds').deleteOne({ metric });
  }

  // Initialize default thresholds
  async initializeDefaultThresholds(): Promise<void> {
    const defaultThresholds: AlertThreshold[] = [
      {
        metric: 'daily_active_users',
        condition: 'below',
        threshold: 10,
        severity: AlertSeverity.WARNING,
        enabled: true
      },
      {
        metric: 'daily_revenue',
        condition: 'below',
        threshold: 1000,
        severity: AlertSeverity.WARNING,
        enabled: true
      },
      {
        metric: 'payment_failure_rate',
        condition: 'above',
        threshold: 10, // 10%
        severity: AlertSeverity.CRITICAL,
        enabled: true
      },
      {
        metric: 'error_rate',
        condition: 'above',
        threshold: 100,
        severity: AlertSeverity.CRITICAL,
        enabled: true
      }
    ];

    for (const threshold of defaultThresholds) {
      const exists = await this.mongoDb.collection('alert_thresholds')
        .findOne({ metric: threshold.metric });
      
      if (!exists) {
        await this.createThreshold(threshold);
      }
    }
  }
}
