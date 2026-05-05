import axios from 'axios';
import { MongoClient, Db, ObjectId } from 'mongodb';
import { ContentApprovalWorkflow } from '../types';

export class ContentManagementService {
  private contentServiceUrl: string;
  private mongoDb: Db;

  constructor(contentServiceUrl: string, mongoDb: Db) {
    this.contentServiceUrl = contentServiceUrl;
    this.mongoDb = mongoDb;
  }

  /**
   * Get all content with filtering
   */
  async getContent(
    type?: string,
    status?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const filter: any = {};
    if (type) filter.type = type;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const [content, total] = await Promise.all([
      this.mongoDb
        .collection('content')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.mongoDb.collection('content').countDocuments(filter)
    ]);

    return {
      content,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }

  /**
   * Create new content
   */
  async createContent(contentData: any, adminToken: string): Promise<any> {
    const response = await axios.post(
      `${this.contentServiceUrl}/api/content`,
      contentData,
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );

    return response.data;
  }

  /**
   * Update existing content
   */
  async updateContent(
    contentId: string,
    updates: any,
    adminToken: string
  ): Promise<any> {
    const response = await axios.put(
      `${this.contentServiceUrl}/api/content/${contentId}`,
      updates,
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );

    return response.data;
  }

  /**
   * Delete content
   */
  async deleteContent(contentId: string, adminToken: string): Promise<any> {
    const response = await axios.delete(
      `${this.contentServiceUrl}/api/content/${contentId}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );

    return response.data;
  }

  /**
   * Approve content for publishing
   */
  async approveContent(
    contentId: string,
    adminId: string,
    comments?: string
  ): Promise<any> {
    const workflow: ContentApprovalWorkflow = {
      contentId,
      contentType: 'content',
      status: 'approved',
      reviewedBy: adminId,
      reviewedAt: new Date(),
      comments
    };

    await this.mongoDb.collection('content_approvals').insertOne(workflow);

    // Update content status
    await this.mongoDb.collection('content').updateOne(
      { _id: new ObjectId(contentId) },
      {
        $set: {
          status: 'published',
          publishedAt: new Date(),
          publishedBy: adminId
        }
      }
    );

    return { success: true, message: 'Content approved and published' };
  }

  /**
   * Reject content
   */
  async rejectContent(
    contentId: string,
    adminId: string,
    reason: string
  ): Promise<any> {
    const workflow: ContentApprovalWorkflow = {
      contentId,
      contentType: 'content',
      status: 'rejected',
      reviewedBy: adminId,
      reviewedAt: new Date(),
      comments: reason
    };

    await this.mongoDb.collection('content_approvals').insertOne(workflow);

    // Update content status
    await this.mongoDb.collection('content').updateOne(
      { _id: new ObjectId(contentId) },
      {
        $set: {
          status: 'rejected',
          rejectedAt: new Date(),
          rejectedBy: adminId,
          rejectionReason: reason
        }
      }
    );

    return { success: true, message: 'Content rejected' };
  }

  /**
   * Bulk publish content
   */
  async bulkPublish(contentIds: string[], adminId: string): Promise<any> {
    const results = {
      successful: [] as string[],
      failed: [] as { contentId: string; error: string }[]
    };

    for (const contentId of contentIds) {
      try {
        await this.approveContent(contentId, adminId);
        results.successful.push(contentId);
      } catch (error: any) {
        results.failed.push({
          contentId,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Bulk unpublish content
   */
  async bulkUnpublish(contentIds: string[]): Promise<any> {
    const objectIds = contentIds.map(id => new ObjectId(id));

    const result = await this.mongoDb.collection('content').updateMany(
      { _id: { $in: objectIds } },
      {
        $set: {
          status: 'draft',
          unpublishedAt: new Date()
        }
      }
    );

    return {
      modifiedCount: result.modifiedCount,
      message: `${result.modifiedCount} content items unpublished`
    };
  }

  /**
   * Get content statistics
   */
  async getContentStatistics(): Promise<any> {
    const stats = await this.mongoDb.collection('content').aggregate([
      {
        $facet: {
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          byType: [
            { $group: { _id: '$type', count: { $sum: 1 } } }
          ],
          total: [
            { $count: 'count' }
          ],
          recent: [
            { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
            { $count: 'count' }
          ]
        }
      }
    ]).toArray();

    const result = stats[0];

    return {
      total: result.total[0]?.count || 0,
      recentlyAdded: result.recent[0]?.count || 0,
      byStatus: result.byStatus.reduce((acc: any, item: any) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byType: result.byType.reduce((acc: any, item: any) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    };
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals(limit: number = 20): Promise<any> {
    const pending = await this.mongoDb
      .collection('content')
      .find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return pending;
  }
}
