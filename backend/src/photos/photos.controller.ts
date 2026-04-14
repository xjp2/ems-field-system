import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PhotosService } from './photos.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';

@Controller('photos')
@UseGuards(JwtAuthGuard)
export class PhotosController {
  constructor(private photosService: PhotosService) {}

  /**
   * Upload a photo for an incident
   */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('incident_id') incidentId: string,
    @Body('caption') caption?: string,
    @Body('taken_at') takenAt?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!incidentId) {
      throw new BadRequestException('incident_id is required');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${allowedTypes.join(', ')}`,
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File too large. Max size: 10MB');
    }

    return this.photosService.uploadPhoto(
      user,
      incidentId,
      file,
      caption,
      takenAt,
    );
  }

  /**
   * Get all photos for an incident
   */
  @Get('incident/:incidentId')
  async findByIncident(
    @CurrentUser() user: AuthenticatedUser,
    @Param('incidentId') incidentId: string,
  ) {
    return this.photosService.findByIncident(user, incidentId);
  }

  /**
   * Get a single photo by ID
   */
  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.photosService.findOne(user, id);
  }

  /**
   * Delete a photo
   */
  @Delete(':id')
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.photosService.delete(user, id);
    return { message: 'Photo deleted successfully' };
  }
}
