import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, IsISO8601 } from 'class-validator';
import { IncidentStatus, PriorityLevel } from '../../config/supabase.config';

export class CreateIncidentDto {
  @ApiProperty({ description: 'Human-readable incident number (e.g., INC-2024-00001)' })
  @IsString()
  incident_number: string;

  @ApiProperty({ description: 'Incident address' })
  @IsString()
  address: string;

  @ApiPropertyOptional({ description: 'Latitude coordinate' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude coordinate' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ description: 'Additional location details' })
  @IsOptional()
  @IsString()
  location_description?: string;

  @ApiPropertyOptional({ enum: ['draft', 'dispatched', 'en_route', 'on_scene', 'transporting', 'arrived', 'closed', 'cancelled'] })
  @IsOptional()
  @IsEnum(['draft', 'dispatched', 'en_route', 'on_scene', 'transporting', 'arrived', 'closed', 'cancelled'])
  status?: IncidentStatus;

  @ApiPropertyOptional({ enum: ['critical', 'urgent', 'non_urgent', 'deceased', 'expectant'] })
  @IsOptional()
  @IsEnum(['critical', 'urgent', 'non_urgent', 'deceased', 'expectant'])
  priority?: PriorityLevel;

  @ApiPropertyOptional({ description: 'Chief complaint / reason for dispatch' })
  @IsOptional()
  @IsString()
  chief_complaint?: string;

  @ApiPropertyOptional({ description: 'Scene description' })
  @IsOptional()
  @IsString()
  scene_description?: string;

  @ApiPropertyOptional({ description: 'Estimated arrival time at hospital' })
  @IsOptional()
  @IsISO8601()
  estimated_arrival?: string;

  @ApiPropertyOptional({ description: 'Local ID assigned by mobile device (for offline sync)' })
  @IsOptional()
  @IsString()
  local_id?: string;

  @ApiPropertyOptional({ description: 'Device ID that created this incident' })
  @IsOptional()
  @IsString()
  device_id?: string;
}
