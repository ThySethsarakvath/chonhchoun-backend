import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { v2 as cloudinaryV2, UploadApiResponse } from 'cloudinary';
import { CLOUDINARY } from '../../../config/cloudinary.config';
import * as streamifier from 'streamifier';
import { Multer } from 'multer';

// Allowed MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(
    @Inject(CLOUDINARY) private readonly cloudinary: typeof cloudinaryV2,
  ) {}

  // Upload a single image buffer to Cloudinary
  async uploadImage(
    file: Express.Multer.File,
    folder: string, // e.g. 'onboarding', 'avatars', 'packages'
  ): Promise<{ url: string; publicId: string }> {
    // Validate type and size
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, and WebP are allowed.',
      );
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File too large. Maximum size is 5MB.');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          // Auto-convert to WebP for best mobile performance
          format: 'webp',
          transformation: [
            // Limit dimensions — prevents storing unnecessarily huge images
            { width: 1200, height: 1200, crop: 'limit', quality: 'auto' },
          ],
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            this.logger.error(
              'Cloudinary upload failed:',
              error?.message || 'No result returned',
            );
            return reject(new BadRequestException('Image upload failed.'));
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        },
      );

      // Stream the file buffer directly to Cloudinary — no temp file on disk
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  // Delete an image by its public_id (used when updating/deleting records)
  async deleteImage(publicId: string): Promise<void> {
    try {
      await this.cloudinary.uploader.destroy(publicId);
      this.logger.log(`Deleted Cloudinary image: ${publicId}`);
    } catch (err) {
      this.logger.warn(`Failed to delete Cloudinary image ${publicId}: ${err}`);
    }
  }

  // Build an optimized URL for a given public_id with transforms
  getOptimizedUrl(publicId: string, width?: number, height?: number): string {
    return this.cloudinary.url(publicId, {
      secure: true,
      format: 'webp',
      quality: 'auto',
      ...(width && { width }),
      ...(height && { height }),
      ...(width || height ? { crop: 'fill' } : {}),
    });
  }
}
