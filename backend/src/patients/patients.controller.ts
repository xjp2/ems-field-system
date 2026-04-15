import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PatientsService, CreatePatientDto } from './patients.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';

@ApiTags('Patients')
@Controller('patients')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PatientsController {
  constructor(private patientsService: PatientsService) {}

  @Post()
  @Roles('FIELD', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Add a patient to an incident' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePatientDto,
  ) {
    return this.patientsService.create(user, dto);
  }

  @Get('incident/:incidentId')
  @ApiOperation({ summary: 'Get all patients for an incident' })
  async findByIncident(
    @CurrentUser() user: AuthenticatedUser,
    @Param('incidentId') incidentId: string,
  ) {
    return this.patientsService.findByIncident(user, incidentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient by ID' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.patientsService.findOne(user, id);
  }

  @Patch(':id')
  @Roles('FIELD', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update patient' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreatePatientDto,
  ) {
    return this.patientsService.update(user, id, dto);
  }
}
