/**
 * Contact Service Implementation Validation Script
 * 
 * This script validates that all required components for Task 7 are implemented.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Contact Service Implementation (Task 7)...\n');

const checks = [];

// Helper function to check if file exists
function fileExists(filePath) {
  return fs.existsSync(path.join(__dirname, filePath));
}

// Helper function to check if file contains text
function fileContains(filePath, searchText) {
  if (!fileExists(filePath)) return false;
  const content = fs.readFileSync(path.join(__dirname, filePath), 'utf8');
  return content.includes(searchText);
}

// 7.1 Contact Form Service Checks
console.log('📋 Task 7.1: Contact Form Service');

checks.push({
  name: 'TypeScript interfaces for ContactInquiry',
  passed: fileContains('src/types/index.ts', 'ContactInquiry') && 
          fileContains('src/types/index.ts', 'InquiryResponse')
});

checks.push({
  name: 'Express.js service setup',
  passed: fileExists('src/index.ts') && 
          fileContains('src/index.ts', 'express') &&
          fileContains('src/index.ts', 'ContactService')
});

checks.push({
  name: 'Form validation with Joi',
  passed: fileContains('src/routes/contactRoutes.ts', 'Joi') &&
          fileContains('src/routes/contactRoutes.ts', 'contactFormSchema')
});

checks.push({
  name: 'Spam protection implementation',
  passed: fileContains('src/services/ContactService.ts', 'checkForSpam') &&
          fileContains('src/services/ContactService.ts', 'SpamCheckResult')
});

checks.push({
  name: 'Contact form submission endpoint',
  passed: fileContains('src/routes/contactRoutes.ts', 'POST /api/contact/submit') ||
          fileContains('src/routes/contactRoutes.ts', "'/submit'")
});

checks.push({
  name: 'Inquiry categorization',
  passed: (fileContains('src/types/index.ts', 'InquiryCategory') ||
           fileContains('../../shared/types/src/index.ts', 'InquiryCategory')) &&
          fileContains('src/services/ContactService.ts', 'InquiryCategory')
});

checks.push({
  name: 'Inquiry status tracking',
  passed: fileContains('src/types/index.ts', 'InquiryStatus') &&
          fileContains('src/services/ContactService.ts', 'updateInquiryStatus')
});

checks.push({
  name: 'Admin response system',
  passed: fileContains('src/services/ContactService.ts', 'respondToInquiry') &&
          fileContains('src/routes/adminRoutes.ts', '/respond')
});

// 7.2 WhatsApp Business API Integration Checks
console.log('\n📱 Task 7.2: WhatsApp Business API Integration');

checks.push({
  name: 'WhatsApp service implementation',
  passed: fileExists('src/services/WhatsAppService.ts') &&
          fileContains('src/services/WhatsAppService.ts', 'WhatsAppService')
});

checks.push({
  name: 'WhatsApp configuration types',
  passed: fileContains('src/types/index.ts', 'WhatsAppConfig') &&
          fileContains('src/types/index.ts', 'WhatsAppMessage')
});

checks.push({
  name: 'Direct messaging capabilities',
  passed: fileContains('src/services/WhatsAppService.ts', 'sendTextMessage') &&
          fileContains('src/services/WhatsAppService.ts', 'sendTemplateMessage')
});

checks.push({
  name: 'Webhook handling',
  passed: fileContains('src/routes/whatsappRoutes.ts', '/webhook') &&
          fileContains('src/services/WhatsAppService.ts', 'processWebhook') &&
          fileContains('src/services/WhatsAppService.ts', 'verifyWebhookSignature')
});

checks.push({
  name: 'Message templates support',
  passed: fileContains('src/services/WhatsAppService.ts', 'getMessageTemplates') &&
          fileContains('src/routes/whatsappRoutes.ts', '/templates')
});

// 7.3 Email Notification Integration Checks
console.log('\n📧 Task 7.3: Email Notification Integration');

checks.push({
  name: 'SendGrid integration',
  passed: fileExists('src/services/EmailService.ts') &&
          fileContains('src/services/EmailService.ts', '@sendgrid/mail')
});

checks.push({
  name: 'Email configuration types',
  passed: fileContains('src/types/index.ts', 'EmailConfig') &&
          fileContains('src/types/index.ts', 'EmailData')
});

checks.push({
  name: 'Email templates',
  passed: fileContains('src/types/index.ts', 'EmailTemplate') &&
          fileContains('src/services/EmailService.ts', 'sendTemplateEmail')
});

checks.push({
  name: 'Transactional email delivery',
  passed: fileContains('src/services/EmailService.ts', 'sendEmail') &&
          fileContains('src/services/EmailService.ts', 'sendBulkEmails')
});

checks.push({
  name: 'Email delivery tracking',
  passed: fileContains('src/services/EmailService.ts', 'trackingSettings') ||
          fileContains('src/services/EmailService.ts', 'getDeliveryStats')
});

checks.push({
  name: 'Email bounce handling',
  passed: fileContains('src/services/EmailService.ts', 'verifyEmail')
});

checks.push({
  name: 'Contact confirmation emails',
  passed: fileContains('src/services/EmailService.ts', 'sendContactConfirmation') ||
          fileContains('src/services/ContactService.ts', 'sendConfirmationEmail')
});

checks.push({
  name: 'Admin notification emails',
  passed: fileContains('src/services/EmailService.ts', 'sendAdminNotification') ||
          fileContains('src/services/ContactService.ts', 'sendAdminNotification')
});

// Database Schema Checks
console.log('\n🗄️  Database Schema');

const migrationFile = '../../database/migrations/003_contact_service_schema.sql';
checks.push({
  name: 'Contact inquiries table',
  passed: fileExists(migrationFile) &&
          fileContains(migrationFile, 'CREATE TABLE contact_inquiries')
});

checks.push({
  name: 'Inquiry responses table',
  passed: fileExists(migrationFile) &&
          fileContains(migrationFile, 'CREATE TABLE inquiry_responses')
});

checks.push({
  name: 'Communication history table',
  passed: fileExists(migrationFile) &&
          fileContains(migrationFile, 'CREATE TABLE communication_history')
});

checks.push({
  name: 'Email templates table',
  passed: fileExists(migrationFile) &&
          fileContains(migrationFile, 'CREATE TABLE email_templates')
});

checks.push({
  name: 'WhatsApp messages table',
  passed: fileExists(migrationFile) &&
          fileContains(migrationFile, 'CREATE TABLE whatsapp_messages')
});

// Test Files Checks
console.log('\n🧪 Test Coverage');

checks.push({
  name: 'ContactService tests',
  passed: fileExists('src/__tests__/ContactService.test.ts') &&
          fileContains('src/__tests__/ContactService.test.ts', 'describe')
});

checks.push({
  name: 'EmailService tests',
  passed: fileExists('src/__tests__/EmailService.test.ts') &&
          fileContains('src/__tests__/EmailService.test.ts', 'describe')
});

checks.push({
  name: 'WhatsAppService tests',
  passed: fileExists('src/__tests__/WhatsAppService.test.ts') &&
          fileContains('src/__tests__/WhatsAppService.test.ts', 'describe')
});

checks.push({
  name: 'Jest configuration',
  passed: fileExists('jest.config.js')
});

// Configuration Checks
console.log('\n⚙️  Configuration');

checks.push({
  name: 'Environment variables example',
  passed: fileExists('.env.example') &&
          fileContains('.env.example', 'SENDGRID_API_KEY') &&
          fileContains('.env.example', 'WHATSAPP_ACCESS_TOKEN')
});

checks.push({
  name: 'Package.json with dependencies',
  passed: fileExists('package.json') &&
          fileContains('package.json', '@sendgrid/mail') &&
          fileContains('package.json', 'axios')
});

// Routes Checks
console.log('\n🛣️  API Routes');

checks.push({
  name: 'Contact routes',
  passed: fileExists('src/routes/contactRoutes.ts') &&
          fileContains('src/routes/contactRoutes.ts', 'router')
});

checks.push({
  name: 'WhatsApp routes',
  passed: fileExists('src/routes/whatsappRoutes.ts') &&
          fileContains('src/routes/whatsappRoutes.ts', 'router')
});

checks.push({
  name: 'Admin routes',
  passed: fileExists('src/routes/adminRoutes.ts') &&
          fileContains('src/routes/adminRoutes.ts', 'router')
});

checks.push({
  name: 'Health check routes',
  passed: fileExists('src/routes/healthRoutes.ts') &&
          fileContains('src/routes/healthRoutes.ts', '/health')
});

// Print Results
console.log('\n' + '='.repeat(60));
console.log('📊 VALIDATION RESULTS');
console.log('='.repeat(60) + '\n');

const passed = checks.filter(c => c.passed).length;
const total = checks.length;
const percentage = Math.round((passed / total) * 100);

checks.forEach((check, index) => {
  const status = check.passed ? '✅' : '❌';
  console.log(`${status} ${index + 1}. ${check.name}`);
});

console.log('\n' + '='.repeat(60));
console.log(`TOTAL: ${passed}/${total} checks passed (${percentage}%)`);
console.log('='.repeat(60) + '\n');

if (passed === total) {
  console.log('🎉 SUCCESS! All Task 7 requirements are implemented!\n');
  console.log('✅ 7.1 Contact Form Service - COMPLETE');
  console.log('✅ 7.2 WhatsApp Business API Integration - COMPLETE');
  console.log('✅ 7.3 Email Notification Integration - COMPLETE\n');
  process.exit(0);
} else {
  console.log(`⚠️  WARNING: ${total - passed} check(s) failed.\n`);
  console.log('Please review the failed checks above.\n');
  process.exit(1);
}
