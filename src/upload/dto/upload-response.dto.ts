import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({
    description: 'Public URL of the uploaded asset',
    example:
      'http://res.cloudinary.com/dexcjehcfive/image/upload/v1234567890/pta/homework.pdf',
  })
  url: string;

  @ApiProperty({
    description: 'Secure HTTPS URL of the uploaded asset',
    example:
      'https://res.cloudinary.com/dexcjehcfive/image/upload/v1234567890/pta/homework.pdf',
  })
  secureUrl: string;

  @ApiProperty({
    description: 'Public ID of the uploaded asset in Cloudinary',
    example: 'pta/homework_1234567890',
  })
  publicId: string;

  @ApiProperty({
    description: 'Format or extension of the asset (e.g. pdf, png, jpg)',
    example: 'pdf',
  })
  format: string;

  @ApiProperty({
    description: 'Cloudinary resource type (image, raw, video)',
    example: 'raw',
  })
  resourceType: string;

  @ApiProperty({
    description: 'Size of the uploaded file in bytes',
    example: 1048576,
  })
  bytes: number;

  @ApiProperty({
    description: 'Original filename of the uploaded file',
    example: 'fractions-worksheet.pdf',
  })
  originalFilename: string;
}
