// Content Management Types

export interface Content {
  id: string;
  type: ContentType;
  title: string;
  content: string;
  metadata: Record<string, any>;
  status: ContentStatus;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

export interface Media {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  cdnUrl?: string;
  thumbnailUrl?: string;
  formats?: MediaFormat[];
  uploadedBy: string;
  uploadedAt: Date;
  metadata: MediaMetadata;
}

export interface MediaFormat {
  format: string;
  width: number;
  height: number;
  url: string;
  size: number;
}

export interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number;
  alt?: string;
  caption?: string;
}

export interface ContentVersion {
  id: string;
  contentId: string;
  version: number;
  content: string;
  metadata: Record<string, any>;
  createdBy: string;
  createdAt: Date;
  comment?: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  company: string;
  content: string;
  rating: number;
  image?: string;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface HeroContent {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  backgroundImage?: string;
  isActive: boolean;
  updatedAt: Date;
}

export interface ApprovalWorkflow {
  id: string;
  contentId: string;
  status: ApprovalStatus;
  requestedBy: string;
  requestedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  comments?: string;
}

export enum ContentType {
  TESTIMONIAL = 'testimonial',
  HERO = 'hero',
  MARKETING = 'marketing',
  COURSE_DESCRIPTION = 'course_description',
  BLOG_POST = 'blog_post'
}

export enum ContentStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}
