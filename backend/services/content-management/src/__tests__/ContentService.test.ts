import { Db } from 'mongodb';
import { ContentService } from '../services/ContentService';
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from './setup';
import { ContentStatus, ContentType } from '../types';

describe('ContentService', () => {
  let db: Db;
  let contentService: ContentService;

  beforeAll(async () => {
    db = await setupTestDatabase();
    contentService = new ContentService(db);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase(db);
  });

  describe('Testimonial Management', () => {
    test('should create a testimonial', async () => {
      const testimonialData = {
        name: 'John Doe',
        role: 'Software Engineer',
        company: 'Tech Corp',
        content: 'Great platform for learning!',
        rating: 5,
        isActive: true,
        order: 1
      };

      const testimonial = await contentService.createTestimonial(testimonialData);

      expect(testimonial).toHaveProperty('id');
      expect(testimonial.name).toBe('John Doe');
      expect(testimonial.rating).toBe(5);
      expect(testimonial).toHaveProperty('createdAt');
      expect(testimonial).toHaveProperty('updatedAt');
    });

    test('should get all active testimonials', async () => {
      await contentService.createTestimonial({
        name: 'John Doe',
        role: 'Engineer',
        company: 'Tech Corp',
        content: 'Great!',
        rating: 5,
        isActive: true,
        order: 1
      });

      await contentService.createTestimonial({
        name: 'Jane Smith',
        role: 'Designer',
        company: 'Design Co',
        content: 'Excellent!',
        rating: 5,
        isActive: false,
        order: 2
      });

      const activeTestimonials = await contentService.getTestimonials({ isActive: true });
      expect(activeTestimonials).toHaveLength(1);
      expect(activeTestimonials[0].name).toBe('John Doe');
    });

    test('should update a testimonial', async () => {
      const testimonial = await contentService.createTestimonial({
        name: 'John Doe',
        role: 'Engineer',
        company: 'Tech Corp',
        content: 'Great!',
        rating: 5,
        isActive: true,
        order: 1
      });

      const updated = await contentService.updateTestimonial(testimonial.id, {
        rating: 4,
        content: 'Updated content'
      });

      expect(updated).not.toBeNull();
      expect(updated?.rating).toBe(4);
      expect(updated?.content).toBe('Updated content');
    });

    test('should delete a testimonial', async () => {
      const testimonial = await contentService.createTestimonial({
        name: 'John Doe',
        role: 'Engineer',
        company: 'Tech Corp',
        content: 'Great!',
        rating: 5,
        isActive: true,
        order: 1
      });

      const deleted = await contentService.deleteTestimonial(testimonial.id);
      expect(deleted).toBe(true);

      const found = await contentService.getTestimonialById(testimonial.id);
      expect(found).toBeNull();
    });
  });

  describe('Hero Content Management', () => {
    test('should update hero content', async () => {
      const heroData = {
        title: 'Welcome to Our Platform',
        subtitle: 'Learn and grow',
        ctaText: 'Get Started',
        ctaLink: '/signup',
        isActive: true
      };

      const hero = await contentService.updateHeroContent(heroData);

      expect(hero).toHaveProperty('id');
      expect(hero.title).toBe('Welcome to Our Platform');
      expect(hero.isActive).toBe(true);
    });

    test('should get active hero content', async () => {
      await contentService.updateHeroContent({
        title: 'Welcome',
        subtitle: 'Learn',
        ctaText: 'Start',
        ctaLink: '/start',
        isActive: true
      });

      const hero = await contentService.getActiveHeroContent();
      expect(hero).not.toBeNull();
      expect(hero?.title).toBe('Welcome');
    });
  });

  describe('Generic Content Management', () => {
    test('should create content with versioning', async () => {
      const contentData = {
        type: ContentType.MARKETING,
        title: 'Marketing Content',
        content: '<p>This is marketing content</p>',
        metadata: { author: 'Admin' },
        status: ContentStatus.DRAFT,
        createdBy: 'user123'
      };

      const content = await contentService.createContent(contentData);

      expect(content).toHaveProperty('id');
      expect(content.version).toBe(1);
      expect(content.title).toBe('Marketing Content');

      // Check version was created
      const versions = await contentService.getContentVersions(content.id);
      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe(1);
    });

    test('should update content and increment version', async () => {
      const content = await contentService.createContent({
        type: ContentType.MARKETING,
        title: 'Original Title',
        content: '<p>Original content</p>',
        metadata: {},
        status: ContentStatus.DRAFT,
        createdBy: 'user123'
      });

      const updated = await contentService.updateContent(
        content.id,
        { content: '<p>Updated content</p>' },
        'user123'
      );

      expect(updated).not.toBeNull();
      expect(updated?.version).toBe(2);
      expect(updated?.content).toBe('<p>Updated content</p>');

      // Check versions
      const versions = await contentService.getContentVersions(content.id);
      expect(versions).toHaveLength(2);
    });

    test('should revert to previous version', async () => {
      const content = await contentService.createContent({
        type: ContentType.MARKETING,
        title: 'Title',
        content: '<p>Version 1</p>',
        metadata: {},
        status: ContentStatus.DRAFT,
        createdBy: 'user123'
      });

      await contentService.updateContent(
        content.id,
        { content: '<p>Version 2</p>' },
        'user123'
      );

      const reverted = await contentService.revertToVersion(content.id, 1, 'user123');

      expect(reverted).not.toBeNull();
      expect(reverted?.content).toBe('<p>Version 1</p>');
      expect(reverted?.version).toBe(3); // New version created
    });
  });

  describe('Approval Workflow', () => {
    test('should create approval request', async () => {
      const content = await contentService.createContent({
        type: ContentType.MARKETING,
        title: 'Content',
        content: '<p>Content</p>',
        metadata: {},
        status: ContentStatus.DRAFT,
        createdBy: 'user123'
      });

      const approval = await contentService.createApprovalRequest({
        contentId: content.id,
        status: 'pending' as any,
        requestedBy: 'user123'
      });

      expect(approval).toHaveProperty('id');
      expect(approval.contentId).toBe(content.id);
      expect(approval.status).toBe('pending');

      // Check content status updated
      const updatedContent = await contentService.getContentById(content.id);
      expect(updatedContent?.status).toBe(ContentStatus.PENDING_REVIEW);
    });

    test('should approve content', async () => {
      const content = await contentService.createContent({
        type: ContentType.MARKETING,
        title: 'Content',
        content: '<p>Content</p>',
        metadata: {},
        status: ContentStatus.DRAFT,
        createdBy: 'user123'
      });

      const approval = await contentService.createApprovalRequest({
        contentId: content.id,
        status: 'pending' as any,
        requestedBy: 'user123'
      });

      const approved = await contentService.approveContent(
        approval.id,
        'reviewer456',
        'Looks good'
      );

      expect(approved).not.toBeNull();
      expect(approved?.status).toBe('approved');
      expect(approved?.reviewedBy).toBe('reviewer456');

      // Check content status
      const updatedContent = await contentService.getContentById(content.id);
      expect(updatedContent?.status).toBe(ContentStatus.APPROVED);
    });

    test('should reject content', async () => {
      const content = await contentService.createContent({
        type: ContentType.MARKETING,
        title: 'Content',
        content: '<p>Content</p>',
        metadata: {},
        status: ContentStatus.DRAFT,
        createdBy: 'user123'
      });

      const approval = await contentService.createApprovalRequest({
        contentId: content.id,
        status: 'pending' as any,
        requestedBy: 'user123'
      });

      const rejected = await contentService.rejectContent(
        approval.id,
        'reviewer456',
        'Needs improvement'
      );

      expect(rejected).not.toBeNull();
      expect(rejected?.status).toBe('rejected');
      expect(rejected?.comments).toBe('Needs improvement');

      // Check content status
      const updatedContent = await contentService.getContentById(content.id);
      expect(updatedContent?.status).toBe(ContentStatus.DRAFT);
    });
  });

  describe('Rich Text Validation', () => {
    test('should validate valid content', () => {
      const validation = contentService.validateRichTextContent('<p>Valid content</p>');
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject empty content', () => {
      const validation = contentService.validateRichTextContent('');
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Content cannot be empty');
    });

    test('should reject content exceeding max length', () => {
      const longContent = 'a'.repeat(50001);
      const validation = contentService.validateRichTextContent(longContent);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Content exceeds maximum length of 50000 characters');
    });

    test('should detect unbalanced HTML tags', () => {
      const validation = contentService.validateRichTextContent('<p>Unclosed paragraph');
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('HTML tags are not properly balanced');
    });
  });
});
