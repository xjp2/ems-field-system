import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VitalsService, CreateVitalDto } from './vitals.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';

@ApiTags('Vitals')
@Controller('vitals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VitalsController {
  constructor(private vitalsService: VitalsService) {}

  @Post()
  @Roles('FIELD', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Record vital signs for a patient' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVitalDto,
  ) {
    return this.vitalsService.create(user, dto);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get all vitals for a patient' })
  async findByPatient(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId') patientId: string,
  ) {
    return this.vitalsService.findByPatient(user, patientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vital by ID' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.vitalsService.findOne(user, id);
  }

  @Patch(':id')
  @Roles('FIELD', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update vital signs' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateVitalDto,
  ) {
    return this.vitalsService.update(user, id, dto);
  }
}
