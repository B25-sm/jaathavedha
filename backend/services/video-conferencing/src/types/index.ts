export enum MeetingProvider {
  ZOOM = 'zoom',
  GOOGLE_MEET = 'google_meet',
}

export enum MeetingStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum RecordingStatus {
  PROCESSING = 'processing',
  AVAILABLE = 'available',
  DOWNLOADING = 'downloading',
  DOWNLOADED = 'downloaded',
  FAILED = 'failed',
}

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
}

export interface Meeting {
  id: string;
  provider: MeetingProvider;
  provider_meeting_id: string;
  session_id: string;
  instructor_id: string;
  title: string;
  description?: string;
  start_time: Date;
  duration_minutes: number;
  timezone: string;
  join_url: string;
  start_url?: string;
  password?: string;
  status: MeetingStatus;
  settings: MeetingSettings;
  created_at: Date;
  updated_at: Date;
}

export interface MeetingSettings {
  waiting_room: boolean;
  auto_recording: boolean;
  mute_upon_entry: boolean;
  allow_screen_sharing: boolean;
  allow_chat: boolean;
  host_video: boolean;
  participant_video: boolean;
}

export interface Recording {
  id: string;
  meeting_id: string;
  provider_recording_id: string;
  file_name: string;
  file_size_bytes: number;
  duration_minutes: number;
  recording_type: string;
  download_url?: string;
  s3_key?: string;
  s3_url?: string;
  status: RecordingStatus;
  recorded_at: Date;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Attendance {
  id: string;
  meeting_id: string;
  user_id: string;
  join_time: Date;
  leave_time?: Date;
  duration_minutes: number;
  status: AttendanceStatus;
  created_at: Date;
  updated_at: Date;
}

export interface ZoomMeetingRequest {
  topic: string;
  type: number;
  start_time: string;
  duration: number;
  timezone: string;
  password?: string;
  agenda?: string;
  settings: {
    host_video: boolean;
    participant_video: boolean;
    join_before_host: boolean;
    mute_upon_entry: boolean;
    watermark: boolean;
    use_pmi: boolean;
    approval_type: number;
    audio: string;
    auto_recording: string;
    waiting_room: boolean;
  };
}

export interface ZoomMeetingResponse {
  id: number;
  uuid: string;
  host_id: string;
  topic: string;
  type: number;
  start_time: string;
  duration: number;
  timezone: string;
  created_at: string;
  join_url: string;
  start_url: string;
  password?: string;
  settings: any;
}

export interface ZoomWebhookEvent {
  event: string;
  payload: {
    account_id: string;
    object: {
      id: string;
      uuid: string;
      host_id: string;
      topic: string;
      type: number;
      start_time: string;
      duration: number;
      timezone: string;
      participant?: {
        user_id: string;
        user_name: string;
        id: string;
        join_time: string;
        leave_time?: string;
      };
      recording_files?: Array<{
        id: string;
        recording_start: string;
        recording_end: string;
        file_type: string;
        file_size: number;
        download_url: string;
        recording_type: string;
      }>;
    };
  };
}

export interface GoogleMeetRequest {
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  conferenceData: {
    createRequest: {
      requestId: string;
      conferenceSolutionKey: {
        type: string;
      };
    };
  };
  attendees?: Array<{
    email: string;
  }>;
}

export interface GoogleMeetResponse {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  hangoutLink: string;
  conferenceData: {
    conferenceId: string;
    conferenceSolution: {
      name: string;
      iconUri: string;
    };
    entryPoints: Array<{
      entryPointType: string;
      uri: string;
      label?: string;
    }>;
  };
}

export interface CreateMeetingRequest {
  provider: MeetingProvider;
  session_id: string;
  instructor_id: string;
  title: string;
  description?: string;
  start_time: Date;
  duration_minutes: number;
  timezone?: string;
  settings?: Partial<MeetingSettings>;
  attendee_emails?: string[];
}

export interface AttendanceReport {
  meeting_id: string;
  meeting_title: string;
  start_time: Date;
  duration_minutes: number;
  total_attendees: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  attendance_percentage: number;
  attendees: Array<{
    user_id: string;
    user_name?: string;
    status: AttendanceStatus;
    join_time?: Date;
    leave_time?: Date;
    duration_minutes: number;
  }>;
}

export interface RecordingDownloadRequest {
  meeting_id: string;
  recording_id: string;
}

export interface ApiError {
  type: string;
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  requestId?: string;
}
