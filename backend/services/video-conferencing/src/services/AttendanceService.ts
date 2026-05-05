import { query, getClient } from '../database';
import logger from '../utils/logger';
import {
  Attendance,
  AttendanceStatus,
  AttendanceReport,
  Meeting,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export default class AttendanceService {
  private minimumDurationMinutes: number;
  private attendanceThresholdPercentage: number;

  constructor() {
    this.minimumDurationMinutes = parseInt(
      process.env.ATTENDANCE_MINIMUM_DURATION_MINUTES || '5'
    );
    this.attendanceThresholdPercentage = parseInt(
      process.env.ATTENDANCE_THRESHOLD_PERCENTAGE || '75'
    );
  }

  /**
   * Record participant join event
   */
  async recordJoin(
    meetingId: string,
    userId: string,
    joinTime: Date
  ): Promise<Attendance> {
    try {
      const attendanceId = uuidv4();

      const insertQuery = `
        INSERT INTO video_conferencing_attendance (
          id, meeting_id, user_id, join_time, duration_minutes, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 0, $5, NOW(), NOW())
        RETURNING *
      `;

      const result = await query(insertQuery, [
        attendanceId,
        meetingId,
        userId,
        joinTime,
        AttendanceStatus.PRESENT,
      ]);

      logger.info('Participant join recorded', { meetingId, userId });

      return this.mapRowToAttendance(result.rows[0]);
    } catch (error) {
      logger.error('Failed to record participant join:', error);
      throw error;
    }
  }

  /**
   * Record participant leave event
   */
  async recordLeave(
    meetingId: string,
    userId: string,
    leaveTime: Date
  ): Promise<void> {
    try {
      // Find the most recent attendance record for this user in this meeting
      const findQuery = `
        SELECT * FROM video_conferencing_attendance 
        WHERE meeting_id = $1 AND user_id = $2 AND leave_time IS NULL
        ORDER BY join_time DESC
        LIMIT 1
      `;

      const findResult = await query(findQuery, [meetingId, userId]);

      if (findResult.rows.length === 0) {
        logger.warn('No active attendance record found for leave event', {
          meetingId,
          userId,
        });
        return;
      }

      const attendance = findResult.rows[0];
      const joinTime = new Date(attendance.join_time);
      const durationMinutes = Math.floor(
        (leaveTime.getTime() - joinTime.getTime()) / 60000
      );

      // Update attendance record
      const updateQuery = `
        UPDATE video_conferencing_attendance 
        SET leave_time = $1, duration_minutes = $2, updated_at = NOW()
        WHERE id = $3
      `;

      await query(updateQuery, [leaveTime, durationMinutes, attendance.id]);

      logger.info('Participant leave recorded', {
        meetingId,
        userId,
        durationMinutes,
      });
    } catch (error) {
      logger.error('Failed to record participant leave:', error);
      throw error;
    }
  }

  /**
   * Process attendance from Zoom participant data
   */
  async processZoomAttendance(
    meetingId: string,
    participants: any[]
  ): Promise<void> {
    try {
      for (const participant of participants) {
        const userId = participant.user_id || participant.id;
        const joinTime = new Date(participant.join_time);
        const leaveTime = participant.leave_time
          ? new Date(participant.leave_time)
          : new Date();

        // Record join
        await this.recordJoin(meetingId, userId, joinTime);

        // Record leave if available
        if (participant.leave_time) {
          await this.recordLeave(meetingId, userId, leaveTime);
        }
      }

      logger.info('Zoom attendance processed', {
        meetingId,
        participantCount: participants.length,
      });
    } catch (error) {
      logger.error('Failed to process Zoom attendance:', error);
      throw error;
    }
  }

  /**
   * Calculate attendance status based on duration
   */
  async calculateAttendanceStatus(
    meetingId: string,
    meetingDurationMinutes: number
  ): Promise<void> {
    try {
      const attendanceRecords = await query(
        'SELECT * FROM video_conferencing_attendance WHERE meeting_id = $1',
        [meetingId]
      );

      for (const record of attendanceRecords.rows) {
        let status: AttendanceStatus;

        if (record.duration_minutes < this.minimumDurationMinutes) {
          status = AttendanceStatus.ABSENT;
        } else {
          const attendancePercentage =
            (record.duration_minutes / meetingDurationMinutes) * 100;

          if (attendancePercentage >= this.attendanceThresholdPercentage) {
            status = AttendanceStatus.PRESENT;
          } else if (attendancePercentage >= 50) {
            status = AttendanceStatus.LATE;
          } else {
            status = AttendanceStatus.ABSENT;
          }
        }

        // Update status
        await query(
          'UPDATE video_conferencing_attendance SET status = $1, updated_at = NOW() WHERE id = $2',
          [status, record.id]
        );
      }

      logger.info('Attendance status calculated', { meetingId });
    } catch (error) {
      logger.error('Failed to calculate attendance status:', error);
      throw error;
    }
  }

  /**
   * Get attendance by meeting ID
   */
  async getAttendanceByMeeting(meetingId: string): Promise<Attendance[]> {
    try {
      const result = await query(
        'SELECT * FROM video_conferencing_attendance WHERE meeting_id = $1 ORDER BY join_time ASC',
        [meetingId]
      );

      return result.rows.map(this.mapRowToAttendance);
    } catch (error) {
      logger.error('Failed to get attendance by meeting:', error);
      throw error;
    }
  }

  /**
   * Get attendance by user ID
   */
  async getAttendanceByUser(userId: string): Promise<Attendance[]> {
    try {
      const result = await query(
        'SELECT * FROM video_conferencing_attendance WHERE user_id = $1 ORDER BY join_time DESC',
        [userId]
      );

      return result.rows.map(this.mapRowToAttendance);
    } catch (error) {
      logger.error('Failed to get attendance by user:', error);
      throw error;
    }
  }

  /**
   * Generate attendance report for a meeting
   */
  async generateAttendanceReport(
    meetingId: string,
    meeting: Meeting
  ): Promise<AttendanceReport> {
    try {
      const attendanceRecords = await this.getAttendanceByMeeting(meetingId);

      const presentCount = attendanceRecords.filter(
        (a) => a.status === AttendanceStatus.PRESENT
      ).length;
      const absentCount = attendanceRecords.filter(
        (a) => a.status === AttendanceStatus.ABSENT
      ).length;
      const lateCount = attendanceRecords.filter(
        (a) => a.status === AttendanceStatus.LATE
      ).length;

      const totalAttendees = attendanceRecords.length;
      const attendancePercentage =
        totalAttendees > 0 ? (presentCount / totalAttendees) * 100 : 0;

      const report: AttendanceReport = {
        meeting_id: meetingId,
        meeting_title: meeting.title,
        start_time: meeting.start_time,
        duration_minutes: meeting.duration_minutes,
        total_attendees: totalAttendees,
        present_count: presentCount,
        absent_count: absentCount,
        late_count: lateCount,
        attendance_percentage: Math.round(attendancePercentage * 100) / 100,
        attendees: attendanceRecords.map((a) => ({
          user_id: a.user_id,
          status: a.status,
          join_time: a.join_time,
          leave_time: a.leave_time,
          duration_minutes: a.duration_minutes,
        })),
      };

      logger.info('Attendance report generated', { meetingId });

      return report;
    } catch (error) {
      logger.error('Failed to generate attendance report:', error);
      throw error;
    }
  }

  /**
   * Get attendance statistics for a user
   */
  async getUserAttendanceStats(userId: string): Promise<any> {
    try {
      const result = await query(
        `SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN status = $1 THEN 1 END) as present_count,
          COUNT(CASE WHEN status = $2 THEN 1 END) as absent_count,
          COUNT(CASE WHEN status = $3 THEN 1 END) as late_count,
          AVG(duration_minutes) as avg_duration_minutes
         FROM video_conferencing_attendance
         WHERE user_id = $4`,
        [
          AttendanceStatus.PRESENT,
          AttendanceStatus.ABSENT,
          AttendanceStatus.LATE,
          userId,
        ]
      );

      const stats = result.rows[0];
      const totalSessions = parseInt(stats.total_sessions);
      const presentCount = parseInt(stats.present_count);

      return {
        user_id: userId,
        total_sessions: totalSessions,
        present_count: presentCount,
        absent_count: parseInt(stats.absent_count),
        late_count: parseInt(stats.late_count),
        attendance_rate:
          totalSessions > 0
            ? Math.round((presentCount / totalSessions) * 100 * 100) / 100
            : 0,
        avg_duration_minutes: parseFloat(stats.avg_duration_minutes) || 0,
      };
    } catch (error) {
      logger.error('Failed to get user attendance stats:', error);
      throw error;
    }
  }

  /**
   * Map database row to Attendance object
   */
  private mapRowToAttendance(row: any): Attendance {
    return {
      id: row.id,
      meeting_id: row.meeting_id,
      user_id: row.user_id,
      join_time: row.join_time,
      leave_time: row.leave_time,
      duration_minutes: row.duration_minutes,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
