/**
 * Test setup file for video streaming service
 */

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockS3 = {
    getSignedUrl: jest.fn().mockReturnValue('https://mock-s3-url.com/upload'),
    upload: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Location: 'https://mock-s3-url.com/file' })
    }),
    getObject: jest.fn().mockReturnValue({
      createReadStream: jest.fn().mockReturnValue({
        pipe: jest.fn(),
        on: jest.fn()
      })
    })
  };

  const mockCloudFront = {
    getDistribution: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({})
    })
  };

  return {
    S3: jest.fn(() => mockS3),
    CloudFront: jest.fn(() => mockCloudFront),
    config: {
      update: jest.fn()
    }
  };
});

// Mock fluent-ffmpeg
jest.mock('fluent-ffmpeg', () => {
  const mockFfmpeg = jest.fn(() => ({
    videoCodec: jest.fn().mockReturnThis(),
    audioCodec: jest.fn().mockReturnThis(),
    size: jest.fn().mockReturnThis(),
    videoBitrate: jest.fn().mockReturnThis(),
    audioBitrate: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    screenshots: jest.fn().mockReturnThis(),
    on: jest.fn(function(event, callback) {
      if (event === 'end') {
        setTimeout(callback, 10);
      }
      return this;
    }),
    run: jest.fn()
  }));

  mockFfmpeg.ffprobe = jest.fn((filePath, callback) => {
    callback(null, {
      format: {
        duration: 120,
        format_name: 'mp4'
      },
      streams: [{
        codec_type: 'video',
        width: 1920,
        height: 1080,
        bit_rate: 5000000,
        r_frame_rate: '30/1',
        codec_name: 'h264'
      }]
    });
  });

  return mockFfmpeg;
});

// Mock database
jest.mock('@sai-mahendra/database', () => ({
  getDatabase: jest.fn(() => ({
    insert: jest.fn().mockResolvedValue({ id: 'mock-id' }),
    update: jest.fn().mockResolvedValue(true),
    queryOne: jest.fn().mockResolvedValue(null),
    queryMany: jest.fn().mockResolvedValue([])
  })),
  getCache: jest.fn(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true)
  })),
  initializeDatabases: jest.fn().mockResolvedValue(true)
}));

// Mock logger
jest.mock('@sai-mahendra/utils', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  },
  AppError: class AppError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message);
      this.name = 'AppError';
    }
  },
  errorHandler: jest.fn((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message });
  }),
  requestLogger: jest.fn((req, res, next) => next())
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.AWS_ACCESS_KEY_ID = 'test-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_S3_BUCKET = 'test-bucket';
process.env.CLOUDFRONT_DOMAIN = 'test-cdn.cloudfront.net';
process.env.VIDEO_ENCRYPTION_ENABLED = 'false';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.ALLOWED_DOMAINS = 'localhost,example.com';

// Global test timeout
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
