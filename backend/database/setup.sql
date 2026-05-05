-- Database setup script for Sai Mahendra Platform
-- Run this script as a PostgreSQL superuser to create the database and user

-- Create database
CREATE DATABASE sai_mahendra_dev;

-- Create user (optional, for production use)
-- CREATE USER sai_mahendra_user WITH PASSWORD 'secure_password';
-- GRANT ALL PRIVILEGES ON DATABASE sai_mahendra_dev TO sai_mahendra_user;

-- Connect to the database
\c sai_mahendra_dev;

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- The migrations will handle the rest of the schema creation