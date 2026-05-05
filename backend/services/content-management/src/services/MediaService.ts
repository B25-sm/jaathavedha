import { S3 } from 'aws-sdk';
import sharp from 'sharp';
import { Db, ObjectId } from 'mongodb';
import { Media, MediaFormat } from '../types';
import crypto from 'crypto';
import path from 'path';

export interface UploadOptions {
  userId: string;
  folder?: string;
  generateFormats?: boolean;
  optimize?: boolean;
}

export class MediaService {
  private s3: S3;
  private bucketName: string;
  private cdnDomain: string;

  constructor(private db: Db) {
    this.s3 = new S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });

    this.bucketName = process.env.S3_BUCKET_NAME || 'sai-mahendra-content';
    this.cdnDomain = process.env.CDN_DOMAIN || `https://${this.bucketName}.s3.amazonaws.com`;
  }

  async uploadFile(
    file: Express.Multer.File,
    options: UploadOptions
  ): Promise<Media> {
    const fileId = this.generateFileId();
    const ext = path.extname(file.originalname);
    const filename = `${fileId}${ext}`;
    const folder = options.folder || 'uploads';
    const key = `${folder}/${filename}`;

    let fileBuffer = file.buffer;
    let metadata = {
      width: undefined as number | undefined,
      height: undefined as number | undefined
    };

    // Process image if it's an image file
    if (this.isImage(file.mimetype)) {
      const imageInfo = await sharp(file.buffer).metadata();
      metadata.width = imageInfo.width;
      metadata.height = imageInfo.height;

      if (options.optimize) {
        fileBuffer = await this.optimizeImage(file.buffer, file.mimetype);
      }
    }

    // Upload original file to S3
    await this.s3.putObject({
      Bucket: this.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
      Metadata: {
        originalName: file.originalname,
        uploadedBy: options.userId
      }
    }).promise();

    const url = `${this.cdnDomain}/${key}`;
    const formats: MediaFormat[] = [];

    // Generate multiple formats for images
    if (options.generateFormats && this.isImage(file.mimetype)) {
      const generatedFormats = await this.generateImageFormats(
        file.buffer,
        fileId,
        folder
      );
      formats.push(...generatedFormats);
    }

    // Generate thumbnail
    let thumbnailUrl: string | undefined;
    if (this.isImage(file.mimetype)) {
      thumbnailUrl = await this.generateThumbnail(file.buffer, fileId, folder);
    }

    // Save media record to database
    const media: Omit<Media, 'id'> = {
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url,
      cdnUrl: url,
      thumbnailUrl,
      formats: formats.length > 0 ? formats : undefined,
      uploadedBy: options.userId,
      uploadedAt: new Date(),
      metadata: {
        width: metadata.width,
        height: metadata.height
      }
    };

    const result = await this.db.collection('media').insertOne(media);
    return { id: result.insertedId.toString(), ...media };
  }

  async getMediaById(id: string): Promise<Media | null> {
    const media = await this.db.collection('media')
      .findOne({ _id: new ObjectId(id) });

    if (!media) return null;
    return { ...media, id: media._id.toString() };
  }

  async getMediaByUser(userId: string): Promise<Media[]> {
    const mediaList = await this.db.collection('media')
      .find({ uploadedBy: userId })
      .sort({ uploadedAt: -1 })
      .toArray();

    return mediaList.map(m => ({ ...m, id: m._id.toString() }));
  }

  async deleteMedia(id: string): Promise<boolean> {
    const media = await this.getMediaById(id);
    if (!media) return false;

    // Delete from S3
    const key = this.extractKeyFromUrl(media.url);
    await this.s3.deleteObject({
      Bucket: this.bucketName,
      Key: key
    }).promise();

    // Delete thumbnail if exists
    if (media.thumbnailUrl) {
      const thumbnailKey = this.extractKeyFromUrl(media.thumbnailUrl);
      await this.s3.deleteObject({
        Bucket: this.bucketName,
        Key: thumbnailKey
      }).promise();
    }

    // Delete formats if exist
    if (media.formats) {
      for (const format of media.formats) {
        const formatKey = this.extractKeyFromUrl(format.url);
        await this.s3.deleteObject({
          Bucket: this.bucketName,
          Key: formatKey
        }).promise();
      }
    }

    // Delete from database
    const result = await this.db.collection('media')
      .deleteOne({ _id: new ObjectId(id) });

    return result.deletedCount > 0;
  }

  async updateMediaMetadata(
    id: string,
    metadata: { alt?: string; caption?: string }
  ): Promise<Media | null> {
    const result = await this.db.collection('media').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { 'metadata.alt': metadata.alt, 'metadata.caption': metadata.caption } },
      { returnDocument: 'after' }
    );

    if (!result) return null;
    return { ...result, id: result._id.toString() };
  }

  private async optimizeImage(buffer: Buffer, mimeType: string): Promise<Buffer> {
    const image = sharp(buffer);

    if (mimeType === 'image/png') {
      return image.png({ quality: 85, compressionLevel: 9 }).toBuffer();
    } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      return image.jpeg({ quality: 80, progressive: true }).toBuffer();
    } else if (mimeType === 'image/webp') {
      return image.webp({ quality: 85 }).toBuffer();
    }

    return buffer;
  }

  private async generateImageFormats(
    buffer: Buffer,
    fileId: string,
    folder: string
  ): Promise<MediaFormat[]> {
    const formats: MediaFormat[] = [];
    const sizes = [
      { name: 'small', width: 640 },
      { name: 'medium', width: 1024 },
      { name: 'large', width: 1920 }
    ];

    for (const size of sizes) {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      // Skip if original is smaller than target size
      if (metadata.width && metadata.width < size.width) continue;

      const resized = await image
        .resize(size.width, null, { withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();

      const resizedMetadata = await sharp(resized).metadata();
      const filename = `${fileId}-${size.name}.webp`;
      const key = `${folder}/${filename}`;

      await this.s3.putObject({
        Bucket: this.bucketName,
        Key: key,
        Body: resized,
        ContentType: 'image/webp',
        ACL: 'public-read'
      }).promise();

      formats.push({
        format: size.name,
        width: resizedMetadata.width || size.width,
        height: resizedMetadata.height || 0,
        url: `${this.cdnDomain}/${key}`,
        size: resized.length
      });
    }

    return formats;
  }

  private async generateThumbnail(
    buffer: Buffer,
    fileId: string,
    folder: string
  ): Promise<string> {
    const thumbnail = await sharp(buffer)
      .resize(150, 150, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    const filename = `${fileId}-thumb.webp`;
    const key = `${folder}/thumbnails/${filename}`;

    await this.s3.putObject({
      Bucket: this.bucketName,
      Key: key,
      Body: thumbnail,
      ContentType: 'image/webp',
      ACL: 'public-read'
    }).promise();

    return `${this.cdnDomain}/${key}`;
  }

  private isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  private generateFileId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private extractKeyFromUrl(url: string): string {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // Remove leading slash
  }

  validateFile(file: Express.Multer.File): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'video/mp4'
    ];

    if (file.size > maxSize) {
      errors.push('File size exceeds 10MB limit');
    }

    if (!allowedTypes.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} is not allowed`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
