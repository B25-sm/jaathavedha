import { Db, ObjectId } from 'mongodb';
import { Content, ContentVersion, Testimonial, HeroContent, ContentStatus, ApprovalWorkflow, ApprovalStatus } from '../types';

export class ContentService {
  constructor(private db: Db) {}

  // Testimonial Management
  async createTestimonial(data: Omit<Testimonial, 'id' | 'createdAt' | 'updatedAt'>): Promise<Testimonial> {
    const testimonial = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.db.collection('testimonials').insertOne(testimonial);
    return { id: result.insertedId.toString(), ...testimonial };
  }

  async getTestimonials(filter: { isActive?: boolean } = {}): Promise<Testimonial[]> {
    const query: any = {};
    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive;
    }

    const testimonials = await this.db.collection('testimonials')
      .find(query)
      .sort({ order: 1, createdAt: -1 })
      .toArray();

    return testimonials.map(t => ({ ...t, id: t._id.toString() }));
  }

  async getTestimonialById(id: string): Promise<Testimonial | null> {
    const testimonial = await this.db.collection('testimonials')
      .findOne({ _id: new ObjectId(id) });

    if (!testimonial) return null;
    return { ...testimonial, id: testimonial._id.toString() };
  }

  async updateTestimonial(id: string, data: Partial<Testimonial>): Promise<Testimonial | null> {
    const updateData = {
      ...data,
      updatedAt: new Date()
    };

    const result = await this.db.collection('testimonials').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) return null;
    return { ...result, id: result._id.toString() };
  }

  async deleteTestimonial(id: string): Promise<boolean> {
    const result = await this.db.collection('testimonials')
      .deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  // Hero Content Management
  async getActiveHeroContent(): Promise<HeroContent | null> {
    const hero = await this.db.collection('hero_content')
      .findOne({ isActive: true });

    if (!hero) return null;
    return { ...hero, id: hero._id.toString() };
  }

  async updateHeroContent(data: Omit<HeroContent, 'id' | 'updatedAt'>): Promise<HeroContent> {
    const heroData = {
      ...data,
      updatedAt: new Date()
    };

    // Deactivate all existing hero content
    await this.db.collection('hero_content').updateMany(
      {},
      { $set: { isActive: false } }
    );

    // Insert or update the new hero content
    const result = await this.db.collection('hero_content').findOneAndUpdate(
      { isActive: true },
      { $set: heroData },
      { upsert: true, returnDocument: 'after' }
    );

    return { ...result, id: result._id.toString() };
  }

  // Generic Content Management
  async createContent(data: Omit<Content, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<Content> {
    const content = {
      ...data,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.db.collection('content').insertOne(content);
    
    // Create initial version
    await this.createContentVersion({
      contentId: result.insertedId.toString(),
      version: 1,
      content: data.content,
      metadata: data.metadata,
      createdBy: data.createdBy,
      createdAt: new Date()
    });

    return { id: result.insertedId.toString(), ...content };
  }

  async getContentById(id: string): Promise<Content | null> {
    const content = await this.db.collection('content')
      .findOne({ _id: new ObjectId(id) });

    if (!content) return null;
    return { ...content, id: content._id.toString() };
  }

  async updateContent(id: string, data: Partial<Content>, userId: string): Promise<Content | null> {
    const existingContent = await this.getContentById(id);
    if (!existingContent) return null;

    const newVersion = existingContent.version + 1;
    const updateData = {
      ...data,
      version: newVersion,
      updatedAt: new Date()
    };

    const result = await this.db.collection('content').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) return null;

    // Create version history
    if (data.content || data.metadata) {
      await this.createContentVersion({
        contentId: id,
        version: newVersion,
        content: data.content || existingContent.content,
        metadata: data.metadata || existingContent.metadata,
        createdBy: userId,
        createdAt: new Date()
      });
    }

    return { ...result, id: result._id.toString() };
  }

  async deleteContent(id: string): Promise<boolean> {
    const result = await this.db.collection('content')
      .deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  // Content Versioning
  async createContentVersion(version: Omit<ContentVersion, 'id'>): Promise<ContentVersion> {
    const result = await this.db.collection('content_versions').insertOne(version);
    return { id: result.insertedId.toString(), ...version };
  }

  async getContentVersions(contentId: string): Promise<ContentVersion[]> {
    const versions = await this.db.collection('content_versions')
      .find({ contentId })
      .sort({ version: -1 })
      .toArray();

    return versions.map(v => ({ ...v, id: v._id.toString() }));
  }

  async getContentVersion(contentId: string, version: number): Promise<ContentVersion | null> {
    const versionDoc = await this.db.collection('content_versions')
      .findOne({ contentId, version });

    if (!versionDoc) return null;
    return { ...versionDoc, id: versionDoc._id.toString() };
  }

  async revertToVersion(contentId: string, version: number, userId: string): Promise<Content | null> {
    const versionDoc = await this.getContentVersion(contentId, version);
    if (!versionDoc) return null;

    const content = await this.getContentById(contentId);
    if (!content) return null;

    return this.updateContent(
      contentId,
      {
        content: versionDoc.content,
        metadata: versionDoc.metadata
      },
      userId
    );
  }

  // Approval Workflow
  async createApprovalRequest(data: Omit<ApprovalWorkflow, 'id' | 'requestedAt'>): Promise<ApprovalWorkflow> {
    const approval = {
      ...data,
      requestedAt: new Date()
    };

    const result = await this.db.collection('approval_workflows').insertOne(approval);
    
    // Update content status to pending review
    await this.db.collection('content').updateOne(
      { _id: new ObjectId(data.contentId) },
      { $set: { status: ContentStatus.PENDING_REVIEW } }
    );

    return { id: result.insertedId.toString(), ...approval };
  }

  async approveContent(approvalId: string, reviewerId: string, comments?: string): Promise<ApprovalWorkflow | null> {
    const approval = await this.db.collection('approval_workflows')
      .findOne({ _id: new ObjectId(approvalId) });

    if (!approval) return null;

    const updateData = {
      status: ApprovalStatus.APPROVED,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      comments
    };

    await this.db.collection('approval_workflows').updateOne(
      { _id: new ObjectId(approvalId) },
      { $set: updateData }
    );

    // Update content status to approved
    await this.db.collection('content').updateOne(
      { _id: new ObjectId(approval.contentId) },
      { $set: { status: ContentStatus.APPROVED } }
    );

    return { ...approval, ...updateData, id: approvalId };
  }

  async rejectContent(approvalId: string, reviewerId: string, comments: string): Promise<ApprovalWorkflow | null> {
    const approval = await this.db.collection('approval_workflows')
      .findOne({ _id: new ObjectId(approvalId) });

    if (!approval) return null;

    const updateData = {
      status: ApprovalStatus.REJECTED,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      comments
    };

    await this.db.collection('approval_workflows').updateOne(
      { _id: new ObjectId(approvalId) },
      { $set: updateData }
    );

    // Update content status back to draft
    await this.db.collection('content').updateOne(
      { _id: new ObjectId(approval.contentId) },
      { $set: { status: ContentStatus.DRAFT } }
    );

    return { ...approval, ...updateData, id: approvalId };
  }

  async getPendingApprovals(): Promise<ApprovalWorkflow[]> {
    const approvals = await this.db.collection('approval_workflows')
      .find({ status: ApprovalStatus.PENDING })
      .sort({ requestedAt: -1 })
      .toArray();

    return approvals.map(a => ({ ...a, id: a._id.toString() }));
  }

  // Content Preview
  async previewContent(contentId: string): Promise<Content | null> {
    return this.getContentById(contentId);
  }

  // Rich Text Validation
  validateRichTextContent(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!content || content.trim().length === 0) {
      errors.push('Content cannot be empty');
    }

    if (content.length > 50000) {
      errors.push('Content exceeds maximum length of 50000 characters');
    }

    // Basic HTML validation
    const openTags = (content.match(/<[^/][^>]*>/g) || []).length;
    const closeTags = (content.match(/<\/[^>]+>/g) || []).length;
    
    if (openTags !== closeTags) {
      errors.push('HTML tags are not properly balanced');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
