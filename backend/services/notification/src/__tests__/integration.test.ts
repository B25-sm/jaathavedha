import request from 'supertest';
import express from 'express';

// Mock app for integration testing
const app = express();
app.use(express.json());

// Mock endpoints for testing
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'notification',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/notifications/email/send', (req, res) => {
  const { to, subject, content } = req.body;
  
  if (!to || !subject || !content) {
    return res.status(400).json({
      success: false,
      error: {
        type: 'VALIDATION_ERROR',
        code: 'MISSING_REQUIRED_FIELDS',
        message: 'Missing required fields'
      }
    });
  }
  
  res.json({
    success: true,
    message: 'Email sent successfully',
    messageId: 'test_message_id'
  });
});

app.post('/api/notifications/push/send', (req, res) => {
  const { tokens, title, body } = req.body;
  
  if (!tokens || !title || !body) {
    return res.status(400).json({
      success: false,
      error: {
        type: 'VALIDATION_ERROR',
        code: 'MISSING_REQUIRED_FIELDS',
        message: 'Missing required fields'
      }
    });
  }
  
  res.json({
    success: true,
    message: 'Push notification sent',
    successCount: tokens.length,
    failureCount: 0
  });
});

app.get('/api/notifications/preferences/:userId', (req, res) => {
  res.json({
    success: true,
    data: {
      userId: req.params.userId,
      email: {
        transactional: true,
        marketing: true,
        engagement: true
      },
      push: {
        enabled: true,
        quietHours: {
          start: '22:00',
          end: '08:00'
        }
      }
    }
  });
});

describe('Notification Service Integration Tests', () => {
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('notification');
    });
  });

  describe('Email Notifications', () => {
    it('should send email successfully', async () => {
      const response = await request(app)
        .post('/api/notifications/email/send')
        .send({
          to: 'test@example.com',
          subject: 'Test Email',
          content: '<p>Test content</p>'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messageId).toBeDefined();
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/notifications/email/send')
        .send({
          to: 'test@example.com'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });
  });

  describe('Push Notifications', () => {
    it('should send push notification successfully', async () => {
      const response = await request(app)
        .post('/api/notifications/push/send')
        .send({
          tokens: ['token1', 'token2'],
          title: 'Test Push',
          body: 'Test body'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.successCount).toBe(2);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/notifications/push/send')
        .send({
          tokens: ['token1']
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('User Preferences', () => {
    it('should fetch user preferences', async () => {
      const response = await request(app)
        .get('/api/notifications/preferences/user_123');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe('user_123');
      expect(response.body.data.email).toBeDefined();
      expect(response.body.data.push).toBeDefined();
    });
  });
});
