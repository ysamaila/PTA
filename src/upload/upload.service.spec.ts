import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { UploadService, MAX_FILE_SIZE_BYTES } from './upload.service.js';
import { Writable } from 'stream';

jest.mock('cloudinary', () => ({
  v2: {
    uploader: {
      upload_stream: jest.fn(),
    },
  },
}));

describe('UploadService', () => {
  let service: UploadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UploadService],
    }).compile();

    service = module.get<UploadService>(UploadService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateFile', () => {
    it('should throw BadRequestException if file is missing or has no buffer', () => {
      expect(() => service.validateFile(null as any)).toThrow(
        BadRequestException,
      );
      expect(() => service.validateFile({ buffer: null } as any)).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if file exceeds maximum size', () => {
      const largeFile = {
        buffer: Buffer.from('test'),
        size: MAX_FILE_SIZE_BYTES + 1,
        mimetype: 'image/png',
      } as Express.Multer.File;

      expect(() => service.validateFile(largeFile)).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for unsupported mimetype', () => {
      const exeFile = {
        buffer: Buffer.from('test'),
        size: 100,
        mimetype: 'application/x-msdownload',
      } as Express.Multer.File;

      expect(() => service.validateFile(exeFile)).toThrow(BadRequestException);
    });

    it('should pass validation for supported image and document mimetypes', () => {
      const validImage = {
        buffer: Buffer.from('test'),
        size: 1024,
        mimetype: 'image/png',
      } as Express.Multer.File;

      const validPdf = {
        buffer: Buffer.from('test'),
        size: 1024,
        mimetype: 'application/pdf',
      } as Express.Multer.File;

      expect(() => service.validateFile(validImage)).not.toThrow();
      expect(() => service.validateFile(validPdf)).not.toThrow();
    });
  });

  describe('uploadFile', () => {
    it('should successfully upload file to Cloudinary and return mapped response', async () => {
      const mockFile = {
        buffer: Buffer.from('dummy file content'),
        size: 500,
        mimetype: 'image/jpeg',
        originalname: 'profile.jpg',
      } as Express.Multer.File;

      const mockCloudinaryResult: Partial<UploadApiResponse> = {
        url: 'http://res.cloudinary.com/demo/image/upload/sample.jpg',
        secure_url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        public_id: 'pta/sample',
        format: 'jpg',
        resource_type: 'image',
        bytes: 500,
      };

      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
        (_options, callback) => {
          const writable = new Writable({
            write(_chunk, _encoding, next) {
              next();
            },
          });
          process.nextTick(() => {
            callback(null, mockCloudinaryResult);
          });
          return writable;
        },
      );

      const result = await service.uploadFile(mockFile, 'pta/avatars');

      expect(result).toEqual({
        url: mockCloudinaryResult.url,
        secureUrl: mockCloudinaryResult.secure_url,
        publicId: mockCloudinaryResult.public_id,
        format: 'jpg',
        resourceType: 'image',
        bytes: 500,
        originalFilename: 'profile.jpg',
      });
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'pta/avatars',
          resource_type: 'auto',
        }),
        expect.any(Function),
      );
    });

    it('should reject with BadRequestException when Cloudinary returns an error', async () => {
      const mockFile = {
        buffer: Buffer.from('dummy file content'),
        size: 500,
        mimetype: 'application/pdf',
        originalname: 'doc.pdf',
      } as Express.Multer.File;

      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
        (_options, callback) => {
          const writable = new Writable({
            write(_chunk, _encoding, next) {
              next();
            },
          });
          process.nextTick(() => {
            callback(new Error('Cloudinary server unavailable'), null);
          });
          return writable;
        },
      );

      await expect(service.uploadFile(mockFile)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('uploadMultipleFiles', () => {
    it('should throw BadRequestException if files array is empty', async () => {
      await expect(service.uploadMultipleFiles([])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if more than 10 files are provided', async () => {
      const files = Array(11).fill({
        buffer: Buffer.from('x'),
        size: 1,
        mimetype: 'image/png',
      }) as Express.Multer.File[];

      await expect(service.uploadMultipleFiles(files)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
