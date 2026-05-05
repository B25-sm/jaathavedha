-- Seed data for Sai Mahendra Platform
-- Migration: 002_seed_data.sql

-- Insert sample programs
INSERT INTO programs (id, name, description, category, price, duration_weeks, features) VALUES
(
    uuid_generate_v4(),
    'AI Starter Program',
    'Introduction to AI and Machine Learning fundamentals with hands-on projects',
    'starter',
    9999.00,
    8,
    '{"includes": ["Basic AI concepts", "Python programming", "ML algorithms", "Project portfolio"], "support": "Community forum", "certificate": true}'
),
(
    uuid_generate_v4(),
    'Full Stack Membership',
    'Comprehensive full-stack development program with monthly live sessions',
    'membership',
    2999.00,
    52,
    '{"includes": ["Frontend development", "Backend APIs", "Database design", "DevOps basics"], "support": "Monthly live sessions", "certificate": true, "billing": "monthly"}'
),
(
    uuid_generate_v4(),
    'AI Accelerator Program',
    'Advanced AI program with personalized mentorship and industry projects',
    'accelerator',
    49999.00,
    16,
    '{"includes": ["Advanced ML/DL", "Computer Vision", "NLP", "Industry projects"], "support": "1-on-1 mentorship", "certificate": true, "job_assistance": true}'
),
(
    uuid_generate_v4(),
    'Pro Developer Track',
    'Elite program for experienced developers transitioning to AI leadership roles',
    'pro_developer',
    99999.00,
    24,
    '{"includes": ["AI architecture", "Team leadership", "Product development", "Startup guidance"], "support": "Executive mentorship", "certificate": true, "job_assistance": true, "network_access": true}'
);

-- Insert sample courses for AI Starter Program
WITH starter_program AS (
    SELECT id FROM programs WHERE category = 'starter' LIMIT 1
)
INSERT INTO courses (program_id, name, description, order_index) 
SELECT 
    starter_program.id,
    course_name,
    course_desc,
    course_order
FROM starter_program,
(VALUES 
    ('Python Fundamentals', 'Learn Python programming basics for AI development', 1),
    ('Introduction to Machine Learning', 'Understanding ML concepts and algorithms', 2),
    ('Data Analysis with Pandas', 'Data manipulation and analysis techniques', 3),
    ('Building Your First AI Model', 'Hands-on project to create a simple AI model', 4)
) AS course_data(course_name, course_desc, course_order);

-- Insert sample modules for the first course
WITH first_course AS (
    SELECT c.id 
    FROM courses c 
    JOIN programs p ON c.program_id = p.id 
    WHERE p.category = 'starter' AND c.order_index = 1 
    LIMIT 1
)
INSERT INTO course_modules (course_id, name, description, order_index, duration_minutes)
SELECT 
    first_course.id,
    module_name,
    module_desc,
    module_order,
    duration
FROM first_course,
(VALUES 
    ('Setting up Python Environment', 'Install Python and development tools', 1, 30),
    ('Variables and Data Types', 'Understanding Python data types and variables', 2, 45),
    ('Control Structures', 'Loops, conditionals, and program flow', 3, 60),
    ('Functions and Modules', 'Creating reusable code with functions', 4, 75),
    ('Working with Libraries', 'Introduction to popular Python libraries', 5, 90)
) AS module_data(module_name, module_desc, module_order, duration);

-- Create admin user (password: Admin@123)
INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, email_verified) VALUES
(
    uuid_generate_v4(),
    'admin@saimahendra.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.PjqIvO',
    'Admin',
    'User',
    'admin',
    'active',
    true
);

-- Create sample instructor user (password: Instructor@123)
INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, email_verified) VALUES
(
    uuid_generate_v4(),
    'instructor@saimahendra.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.PjqIvO',
    'Sai',
    'Mahendra',
    'instructor',
    'active',
    true
);

-- Create sample student user (password: Student@123)
INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, status, email_verified) VALUES
(
    uuid_generate_v4(),
    'student@example.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.PjqIvO',
    'John',
    'Doe',
    '+91-9876543210',
    'student',
    'active',
    true
);

-- Insert sample contact inquiry
INSERT INTO contact_inquiries (name, email, phone, subject, message, type, status) VALUES
(
    'Jane Smith',
    'jane.smith@example.com',
    '+91-9876543211',
    'Inquiry about AI Starter Program',
    'Hi, I am interested in learning more about the AI Starter Program. Could you please provide more details about the curriculum and prerequisites?',
    'enrollment',
    'new'
);

-- Create sample enrollment for the student
WITH student_user AS (
    SELECT id FROM users WHERE email = 'student@example.com' LIMIT 1
),
starter_program AS (
    SELECT id FROM programs WHERE category = 'starter' LIMIT 1
)
INSERT INTO enrollments (user_id, program_id, status, progress_percentage, enrolled_at)
SELECT 
    student_user.id,
    starter_program.id,
    'active',
    25,
    NOW() - INTERVAL '7 days'
FROM student_user, starter_program;

-- Create sample payment for the enrollment
WITH student_user AS (
    SELECT id FROM users WHERE email = 'student@example.com' LIMIT 1
),
starter_program AS (
    SELECT id FROM programs WHERE category = 'starter' LIMIT 1
)
INSERT INTO payments (user_id, program_id, amount, currency, gateway, gateway_payment_id, status, payment_method, completed_at)
SELECT 
    student_user.id,
    starter_program.id,
    9999.00,
    'INR',
    'razorpay',
    'pay_sample123456789',
    'completed',
    'card',
    NOW() - INTERVAL '7 days'
FROM student_user, starter_program;

-- Create sample user progress
WITH student_user AS (
    SELECT id FROM users WHERE email = 'student@example.com' LIMIT 1
),
first_course AS (
    SELECT c.id 
    FROM courses c 
    JOIN programs p ON c.program_id = p.id 
    WHERE p.category = 'starter' AND c.order_index = 1 
    LIMIT 1
),
completed_modules AS (
    SELECT cm.id, cm.course_id
    FROM course_modules cm
    JOIN first_course fc ON cm.course_id = fc.id
    WHERE cm.order_index <= 2
)
INSERT INTO user_progress (user_id, course_id, module_id, completed, completion_percentage, time_spent_minutes, completed_at)
SELECT 
    student_user.id,
    cm.course_id,
    cm.id,
    true,
    100,
    45,
    NOW() - INTERVAL '3 days'
FROM student_user, completed_modules cm;