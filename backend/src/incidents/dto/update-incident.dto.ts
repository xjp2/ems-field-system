import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, IsISO8601 } from 'class-validator';
import { IncidentStatus, PriorityLevel } from '../../config/supabase.config';

export class UpdateIncidentDto {
  @ApiPropertyOptional({ description: 'Incident address' })
  @IsOptional()
  @IsString()
  address?: string;

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

  @ApiPropertyOptional({ description: 'Chief complaint' })
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

  @ApiPropertyOptional({ description: 'Timestamp when dispatched' })
  @IsOptional()
  @IsISO8601()
  dispatched_at?: string;

  @ApiPropertyOptional({ description: 'Timestamp when en route' })
  @IsOptional()
  @IsISO8601()
  en_route_at?: string;

  @ApiPropertyOptional({ description: 'Timestamp when arrived on scene' })
  @IsOptional()
  @IsISO8601()
  on_scene_at?: string;

  @ApiPropertyOptional({ description: 'Timestamp when transporting' })
  @IsOptional()
  @IsISO8601()
  transporting_at?: string;

  @ApiPropertyOptional({ description: 'Timestamp when arrived at hospital' })
  @IsOptional()
  @IsISO8601()
  arrived_at?: string;

  @ApiPropertyOptional({ description: 'Timestamp when closed' })
  @IsOptional()
  @IsISO8601()
  closed_at?: string;
}
