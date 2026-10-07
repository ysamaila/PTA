import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { UploadResponseDto } from './dto/upload-response.dto.js';

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
]);

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  validateFile(file: Express.Multer.File): void {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded or file buffer is empty');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File size exceeds maximum allowed limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed types include images, PDFs, office documents, audio, and plain text.`,
      );
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'pta',
  ): Promise<UploadResponseDto> {
    this.validateFile(file);

    const targetFolder = (folder || 'pta')
      .trim()
      .replace(/[^a-zA-Z0-9_\-/]/g, '');

    return new Promise<UploadResponseDto>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: targetFolder,
          resource_type: 'auto',
          use_filename: true,
          unique_filename: true,
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error) {
            this.logger.error(`Cloudinary upload failed: ${error.message}`);
            return reject(
              new BadRequestException(
                `Cloudinary upload error: ${error.message}`,
              ),
            );
          }

          if (!result) {
            return reject(
              new BadRequestException(
                'Cloudinary upload returned empty response',
              ),
            );
          }

          resolve({
            url: result.url,
            secureUrl: result.secure_url,
            publicId: result.public_id,
            format: result.format || result.resource_type,
            resourceType: result.resource_type,
            bytes: result.bytes,
            originalFilename: file.originalname,
          });
        },
      );

      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: string = 'pta',
  ): Promise<UploadResponseDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file must be provided');
    }

    if (files.length > 10) {
      throw new BadRequestException(
        'Maximum of 10 files can be uploaded at a time',
      );
    }

    return Promise.all(files.map((file) => this.uploadFile(file, folder)));
  }
}
