// MongoDB initialization script for Sai Mahendra Platform
// Creates databases and collections with proper indexes

// Switch to analytics database
db = db.getSiblingDB('sai_mahendra_analytics');

// Create collections with validation
db.createCollection('analytics_events', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['type', 'timestamp'],
      properties: {
        type: {
          bsonType: 'string',
          description: 'Event type is required'
        },
        userId: {
          bsonType: 'string',
          description: 'User ID if applicable'
        },
        sessionId: {
          bsonType: 'string',
          description: 'Session ID if applicable'
        },
        data: {
          bsonType: 'object',
          description: 'Event data'
        },
        timestamp: {
          bsonType: 'date',
          description: 'Event timestamp is required'
        }
      }
    }
  }
});

// Create indexes for analytics events
db.analytics_events.createIndex({ type: 1, timestamp: -1 });
db.analytics_events.createIndex({ userId: 1, timestamp: -1 });
db.analytics_events.createIndex({ sessionId: 1 });
db.analytics_events.createIndex({ timestamp: -1 });

// Switch to content database
db = db.getSiblingDB('sai_mahendra_content');

// Create content collection
db.createCollection('content', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['type', 'title', 'status'],
      properties: {
        type: {
          bsonType: 'string',
          enum: ['testimonial', 'hero', 'marketing', 'course_material'],
          description: 'Content type is required'
        },
        title: {
          bsonType: 'string',
          description: 'Content title is required'
        },
        content: {
          bsonType: 'object',
          description: 'Content data'
        },
        status: {
          bsonType: 'string',
          enum: ['draft', 'published', 'archived'],
          description: 'Content status is required'
        },
        authorId: {
          bsonType: 'string',
          description: 'Author user ID'
        },
        version: {
          bsonType: 'int',
          minimum: 1,
          description: 'Content version number'
        }
      }
    }
  }
});

// Create indexes for content
db.content.createIndex({ type: 1, status: 1 });
db.content.createIndex({ authorId: 1 });
db.content.createIndex({ createdAt: -1 });

// Create audit logs collection
db.createCollection('audit_logs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['action', 'userId', 'resource'],
      properties: {
        action: {
          bsonType: 'string',
          description: 'Action performed'
        },
        userId: {
          bsonType: 'string',
          description: 'User who performed the action'
        },
        resource: {
          bsonType: 'string',
          description: 'Resource affected'
        },
        resourceId: {
          bsonType: 'string',
          description: 'ID of the affected resource'
        },
        details: {
          bsonType: 'object',
          description: 'Additional details'
        },
        ipAddress: {
          bsonType: 'string',
          description: 'IP address of the user'
        },
        userAgent: {
          bsonType: 'string',
          description: 'User agent string'
        }
      }
    }
  }
});

// Create indexes for audit logs
db.audit_logs.createIndex({ userId: 1, createdAt: -1 });
db.audit_logs.createIndex({ action: 1 });
db.audit_logs.createIndex({ resource: 1, resourceId: 1 });
db.audit_logs.createIndex({ createdAt: -1 });

// Insert sample content data
db.content.insertMany([
  {
    type: 'testimonial',
    title: 'Student Success Story - Rahul Sharma',
    content: {
      name: 'Rahul Sharma',
      role: 'AI Engineer at TechCorp',
      image: '/testimonials/rahul-sharma.jpg',
      rating: 5,
      text: 'The AI Accelerator program completely transformed my career. The hands-on projects and mentorship helped me land my dream job as an AI Engineer.',
      program: 'AI Accelerator Program'
    },
    status: 'published',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    type: 'testimonial',
    title: 'Career Transition Success - Priya Patel',
    content: {
      name: 'Priya Patel',
      role: 'Full Stack Developer at StartupXYZ',
      image: '/testimonials/priya-patel.jpg',
      rating: 5,
      text: 'Coming from a non-tech background, the Full Stack Membership program gave me all the skills I needed to become a professional developer.',
      program: 'Full Stack Membership'
    },
    status: 'published',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    type: 'hero',
    title: 'Main Hero Section',
    content: {
      headline: 'Master AI & Full Stack Development',
      subheadline: 'Transform your career with industry-leading programs designed by experts',
      ctaText: 'Start Your Journey',
      ctaLink: '/programs',
      backgroundImage: '/hero/main-bg.jpg',
      features: [
        'Expert-led curriculum',
        'Hands-on projects',
        'Career support',
        'Industry connections'
      ]
    },
    status: 'published',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// Insert sample analytics events
db = db.getSiblingDB('sai_mahendra_analytics');

db.analytics_events.insertMany([
  {
    type: 'page_view',
    data: {
      page: '/programs',
      referrer: 'https://google.com',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    timestamp: new Date(Date.now() - 86400000) // 1 day ago
  },
  {
    type: 'program_view',
    data: {
      programId: 'ai-starter',
      programName: 'AI Starter Program',
      duration: 45000 // 45 seconds
    },
    timestamp: new Date(Date.now() - 43200000) // 12 hours ago
  },
  {
    type: 'contact_form_submit',
    data: {
      formType: 'enrollment_inquiry',
      program: 'AI Accelerator Program'
    },
    timestamp: new Date(Date.now() - 21600000) // 6 hours ago
  }
]);

print('MongoDB initialization completed successfully');
print('Created databases: sai_mahendra_analytics, sai_mahendra_content');
print('Created collections with indexes and sample data');