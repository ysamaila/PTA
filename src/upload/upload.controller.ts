import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { UploadService } from './upload.service.js';
import { UploadResponseDto } from './dto/upload-response.dto.js';
import {
  MultipleFilesUploadDto,
  SingleFileUploadDto,
} from './dto/file-upload.dto.js';

@ApiTags('Uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a single file to Cloudinary',
    description:
      'Uploads an image, PDF, or document to Cloudinary and returns the secure URL and metadata.',
  })
  @ApiBody({ type: SingleFileUploadDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File successfully uploaded to Cloudinary',
    type: UploadResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid file size, missing file, or unsupported file type',
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') bodyFolder?: string,
    @Query('folder') queryFolder?: string,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException(
        'A file must be provided in the "file" form field',
      );
    }
    const folder = bodyFolder || queryFolder || 'pta';
    return this.uploadService.uploadFile(file, folder);
  }

  @Post('multiple')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload multiple files to Cloudinary (up to 10)',
    description:
      'Uploads up to 10 files to Cloudinary concurrently and returns an array of uploaded asset details.',
  })
  @ApiBody({ type: MultipleFilesUploadDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Files successfully uploaded to Cloudinary',
    type: [UploadResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Missing files or unsupported file types',
  })
  async uploadMultipleFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('folder') bodyFolder?: string,
    @Query('folder') queryFolder?: string,
  ): Promise<UploadResponseDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException(
        'At least one file must be provided in the "files" form field',
      );
    }
    const folder = bodyFolder || queryFolder || 'pta';
    return this.uploadService.uploadMultipleFiles(files, folder);
  }
}
