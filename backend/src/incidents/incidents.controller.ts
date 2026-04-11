import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';

@ApiTags('Incidents')
@Controller('incidents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IncidentsController {
  constructor(private incidentsService: IncidentsService) {}

  /**
   * Create a new incident
   * FIELD role required
   */
  @Post()
  @Roles('FIELD', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create a new incident' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateIncidentDto,
  ) {
    return this.incidentsService.create(user, dto);
  }

  /**
   * Get all incidents for the current user
   * RLS filters based on role (FIELD = own, COMMAND = all for hospital)
   */
  @Get()
  @ApiOperation({ summary: 'Get all incidents for current user' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.incidentsService.findAll(user);
  }

  /**
   * Get active incidents (not closed/cancelled)
   * COMMAND role required
   */
  @Get('active')
  @Roles('COMMAND', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get all active incidents (Command Dashboard)' })
  async findActive(@CurrentUser() user: AuthenticatedUser) {
    return this.incidentsService.findActive(user);
  }

  /**
   * Get a single incident by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get incident by ID' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.incidentsService.findOne(user, id);
  }

  /**
   * Get incident with patients and vitals
   */
  @Get(':id/detail')
  @ApiOperation({ summary: 'Get incident with patients and latest vitals' })
  async findWithPatients(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.incidentsService.findWithPatients(user, id);
  }

  /**
   * Update an incident
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update incident' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
  ) {
    return this.incidentsService.update(user, id, dto);
  }
}
