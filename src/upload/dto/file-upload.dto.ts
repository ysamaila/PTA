import { ApiProperty } from '@nestjs/swagger';

export class SingleFileUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'File to upload (image, pdf, document, etc.)',
  })
  file: Express.Multer.File;

  @ApiProperty({
    required: false,
    description: 'Cloudinary folder to store the asset (defaults to pta)',
    example: 'pta/homework',
  })
  folder?: string;
}

export class MultipleFilesUploadDto {
  @ApiProperty({
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    description: 'Multiple files to upload (max 10)',
  })
  files: Express.Multer.File[];

  @ApiProperty({
    required: false,
    description: 'Cloudinary folder to store the assets (defaults to pta)',
    example: 'pta/homework',
  })
  folder?: string;
}
