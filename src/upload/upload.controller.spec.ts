import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UploadController } from './upload.controller.js';
import { UploadService } from './upload.service.js';
import { UploadResponseDto } from './dto/upload-response.dto.js';

describe('UploadController', () => {
  let controller: UploadController;
  let uploadService: {
    uploadFile: jest.Mock;
    uploadMultipleFiles: jest.Mock;
  };

  beforeEach(async () => {
    uploadService = {
      uploadFile: jest.fn(),
      uploadMultipleFiles: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        {
          provide: UploadService,
          useValue: uploadService,
        },
      ],
    }).compile();

    controller = module.get<UploadController>(UploadController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should throw BadRequestException if file is missing', async () => {
      await expect(controller.uploadFile(null as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should call uploadService.uploadFile and return result', async () => {
      const mockFile = {
        buffer: Buffer.from('test'),
        originalname: 'test.jpg',
      } as Express.Multer.File;

      const expectedResponse: UploadResponseDto = {
        url: 'http://res.cloudinary.com/demo/image/upload/test.jpg',
        secureUrl: 'https://res.cloudinary.com/demo/image/upload/test.jpg',
        publicId: 'pta/test',
        format: 'jpg',
        resourceType: 'image',
        bytes: 100,
        originalFilename: 'test.jpg',
      };

      uploadService.uploadFile.mockResolvedValue(expectedResponse);

      const result = await controller.uploadFile(mockFile, 'custom-folder');

      expect(uploadService.uploadFile).toHaveBeenCalledWith(
        mockFile,
        'custom-folder',
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('uploadMultipleFiles', () => {
    it('should throw BadRequestException if files array is empty', async () => {
      await expect(controller.uploadMultipleFiles([])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should call uploadService.uploadMultipleFiles and return results', async () => {
      const mockFiles = [
        { buffer: Buffer.from('1'), originalname: '1.jpg' },
      ] as Express.Multer.File[];

      const expectedResponses: UploadResponseDto[] = [
        {
          url: 'http://res.cloudinary.com/demo/image/upload/1.jpg',
          secureUrl: 'https://res.cloudinary.com/demo/image/upload/1.jpg',
          publicId: 'pta/1',
          format: 'jpg',
          resourceType: 'image',
          bytes: 100,
          originalFilename: '1.jpg',
        },
      ];

      uploadService.uploadMultipleFiles.mockResolvedValue(expectedResponses);

      const result = await controller.uploadMultipleFiles(mockFiles);

      expect(uploadService.uploadMultipleFiles).toHaveBeenCalledWith(
        mockFiles,
        'pta',
      );
      expect(result).toEqual(expectedResponses);
    });
  });
});
