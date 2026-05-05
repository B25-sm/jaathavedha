import { getDatabase } from '@sai-mahendra/database';
import { logger, AppError } from '@sai-mahendra/utils';

interface StudyGroupData {
  course_id: string;
  name: string;
  description: string;
  max_members?: number;
  is_private?: boolean;
  created_by: string;
}

export class StudyGroupService {
  private db = getDatabase();

  /**
   * Create a new study group
   */
  async createGroup(groupData: StudyGroupData) {
    try {
      if (!groupData.name || groupData.name.trim().length === 0) {
        throw new AppError('Study group name is required', 400);
      }

      if (!groupData.description || groupData.description.trim().length === 0) {
        throw new AppError('Study group description is required', 400);
      }

      const maxMembers = groupData.max_members || 10;
      if (maxMembers < 2 || maxMembers > 50) {
        throw new AppError('Max members must be between 2 and 50', 400);
      }

      // Create the study group
      const group = await this.db.insert('study_groups', {
        course_id: groupData.course_id,
        name: groupData.name.trim(),
        description: groupData.description.trim(),
        max_members: maxMembers,
        current_members: 1, // Creator is the first member
        is_private: groupData.is_private || false,
        created_by: groupData.created_by,
      });

      // Add creator as owner
      await this.db.insert('study_group_members', {
        group_id: group.id,
        user_id: groupData.created_by,
        role: 'owner',
      });

      logger.info('Study group created successfully', { 
        groupId: group.id, 
        courseId: groupData.course_id 
      });

      return group;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to create study group', { error, groupData });
      throw new AppError('Failed to create study group', 500);
    }
  }

  /**
   * Get study groups for a course
   */
  async getGroups(courseId: string, options?: { includePrivate?: boolean; userId?: string }) {
    try {
      let query = `
        SELECT sg.*, 
               u.first_name || ' ' || u.last_name as creator_name,
               CASE 
                 WHEN sgm.user_id IS NOT NULL THEN true 
                 ELSE false 
               END as is_member
        FROM study_groups sg
        LEFT JOIN users u ON sg.created_by = u.id
      `;

      const params: any[] = [courseId];
      
      if (options?.userId) {
        query += `
          LEFT JOIN study_group_members sgm ON sg.id = sgm.group_id AND sgm.user_id = $2
          WHERE sg.course_id = $1
        `;
        params.push(options.userId);
      } else {
        query += ' WHERE sg.course_id = $1';
      }

      if (!options?.includePrivate) {
        query += ' AND sg.is_private = FALSE';
      }

      query += ' ORDER BY sg.created_at DESC';

      const groups = await this.db.queryMany(query, params);
      return groups;
    } catch (error) {
      logger.error('Failed to get study groups', { error, courseId });
      throw new AppError('Failed to retrieve study groups', 500);
    }
  }

  /**
   * Get a single study group by ID
   */
  async getGroupById(groupId: string, userId?: string) {
    try {
      const group = await this.db.queryOne(
        `SELECT sg.*, 
                u.first_name || ' ' || u.last_name as creator_name
         FROM study_groups sg
         LEFT JOIN users u ON sg.created_by = u.id
         WHERE sg.id = $1`,
        [groupId]
      );

      if (!group) {
        throw new AppError('Study group not found', 404);
      }

      // Check if user is a member (if userId provided)
      if (userId) {
        const membership = await this.db.queryOne(
          'SELECT role FROM study_group_members WHERE group_id = $1 AND user_id = $2',
          [groupId, userId]
        );
        group.is_member = !!membership;
        group.member_role = membership?.role || null;
      }

      return group;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to get study group by ID', { error, groupId });
      throw new AppError('Failed to retrieve study group', 500);
    }
  }

  /**
   * Join a study group
   */
  async joinGroup(groupId: string, userId: string) {
    try {
      // Get group details
      const group = await this.db.queryOne(
        'SELECT current_members, max_members, is_private FROM study_groups WHERE id = $1',
        [groupId]
      );

      if (!group) {
        throw new AppError('Study group not found', 404);
      }

      if (group.is_private) {
        throw new AppError('Cannot join private study group without invitation', 403);
      }

      if (group.current_members >= group.max_members) {
        throw new AppError('Study group is full', 400);
      }

      // Check if already a member
      const existingMember = await this.db.queryOne(
        'SELECT id FROM study_group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, userId]
      );

      if (existingMember) {
        throw new AppError('Already a member of this study group', 400);
      }

      // Add member
      const member = await this.db.insert('study_group_members', {
        group_id: groupId,
        user_id: userId,
        role: 'member',
      });

      // Increment member count
      await this.db.query(
        'UPDATE study_groups SET current_members = current_members + 1 WHERE id = $1',
        [groupId]
      );

      logger.info('User joined study group', { groupId, userId });

      return member;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to join study group', { error, groupId, userId });
      throw new AppError('Failed to join study group', 500);
    }
  }

  /**
   * Leave a study group
   */
  async leaveGroup(groupId: string, userId: string) {
    try {
      // Check membership
      const member = await this.db.queryOne(
        'SELECT role FROM study_group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, userId]
      );

      if (!member) {
        throw new AppError('Not a member of this study group', 400);
      }

      if (member.role === 'owner') {
        // Check if there are other members
        const memberCount = await this.db.queryOne(
          'SELECT COUNT(*) as count FROM study_group_members WHERE group_id = $1',
          [groupId]
        );

        if (parseInt(memberCount.count) > 1) {
          throw new AppError('Owner must transfer ownership before leaving', 400);
        }

        // If owner is the only member, delete the group
        await this.db.delete('study_groups', groupId);
        logger.info('Study group deleted (owner left)', { groupId, userId });
      } else {
        // Remove member
        await this.db.query(
          'DELETE FROM study_group_members WHERE group_id = $1 AND user_id = $2',
          [groupId, userId]
        );

        // Decrement member count
        await this.db.query(
          'UPDATE study_groups SET current_members = current_members - 1 WHERE id = $1',
          [groupId]
        );

        logger.info('User left study group', { groupId, userId });
      }

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to leave study group', { error, groupId, userId });
      throw new AppError('Failed to leave study group', 500);
    }
  }

  /**
   * Get members of a study group
   */
  async getGroupMembers(groupId: string) {
    try {
      const members = await this.db.queryMany(
        `SELECT sgm.*, 
                u.first_name || ' ' || u.last_name as name,
                u.email
         FROM study_group_members sgm
         LEFT JOIN users u ON sgm.user_id = u.id
         WHERE sgm.group_id = $1
         ORDER BY 
           CASE sgm.role 
             WHEN 'owner' THEN 1 
             WHEN 'moderator' THEN 2 
             ELSE 3 
           END,
           sgm.joined_at ASC`,
        [groupId]
      );

      return members;
    } catch (error) {
      logger.error('Failed to get group members', { error, groupId });
      throw new AppError('Failed to retrieve group members', 500);
    }
  }

  /**
   * Update member role
   */
  async updateMemberRole(groupId: string, targetUserId: string, newRole: 'moderator' | 'member', requestingUserId: string) {
    try {
      // Verify requesting user is owner
      const requestingMember = await this.db.queryOne(
        'SELECT role FROM study_group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, requestingUserId]
      );

      if (!requestingMember || requestingMember.role !== 'owner') {
        throw new AppError('Only the group owner can change member roles', 403);
      }

      // Update role
      await this.db.query(
        'UPDATE study_group_members SET role = $1 WHERE group_id = $2 AND user_id = $3',
        [newRole, groupId, targetUserId]
      );

      logger.info('Member role updated', { groupId, targetUserId, newRole });

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to update member role', { error, groupId, targetUserId });
      throw new AppError('Failed to update member role', 500);
    }
  }

  /**
   * Remove a member from the group
   */
  async removeMember(groupId: string, targetUserId: string, requestingUserId: string) {
    try {
      // Verify requesting user is owner or moderator
      const requestingMember = await this.db.queryOne(
        'SELECT role FROM study_group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, requestingUserId]
      );

      if (!requestingMember || (requestingMember.role !== 'owner' && requestingMember.role !== 'moderator')) {
        throw new AppError('Only owners and moderators can remove members', 403);
      }

      // Cannot remove owner
      const targetMember = await this.db.queryOne(
        'SELECT role FROM study_group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, targetUserId]
      );

      if (!targetMember) {
        throw new AppError('Member not found', 404);
      }

      if (targetMember.role === 'owner') {
        throw new AppError('Cannot remove the group owner', 403);
      }

      // Remove member
      await this.db.query(
        'DELETE FROM study_group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, targetUserId]
      );

      // Decrement member count
      await this.db.query(
        'UPDATE study_groups SET current_members = current_members - 1 WHERE id = $1',
        [groupId]
      );

      logger.info('Member removed from study group', { groupId, targetUserId, requestingUserId });

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to remove member', { error, groupId, targetUserId });
      throw new AppError('Failed to remove member', 500);
    }
  }

  /**
   * Update study group details
   */
  async updateGroup(groupId: string, userId: string, updates: { name?: string; description?: string; max_members?: number }) {
    try {
      // Verify user is owner
      const member = await this.db.queryOne(
        'SELECT role FROM study_group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, userId]
      );

      if (!member || member.role !== 'owner') {
        throw new AppError('Only the group owner can update group details', 403);
      }

      const updateData: any = {};
      if (updates.name) updateData.name = updates.name.trim();
      if (updates.description) updateData.description = updates.description.trim();
      if (updates.max_members) {
        if (updates.max_members < 2 || updates.max_members > 50) {
          throw new AppError('Max members must be between 2 and 50', 400);
        }
        updateData.max_members = updates.max_members;
      }

      if (Object.keys(updateData).length === 0) {
        throw new AppError('No valid updates provided', 400);
      }

      await this.db.update('study_groups', groupId, updateData);

      logger.info('Study group updated', { groupId, userId });

      return { success: true };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to update study group', { error, groupId });
      throw new AppError('Failed to update study group', 500);
    }
  }
}
