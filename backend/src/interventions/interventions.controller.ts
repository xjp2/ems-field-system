import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InterventionsService, CreateInterventionDto } from './interventions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';

@ApiTags('Interventions')
@Controller('interventions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InterventionsController {
  constructor(private interventionsService: InterventionsService) {}

  @Post()
  @Roles('FIELD', 'ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Record an intervention for a patient' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInterventionDto,
  ) {
    return this.interventionsService.create(user, dto);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get all interventions for a patient' })
  async findByPatient(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId') patientId: string,
  ) {
    return this.interventionsService.findByPatient(user, patientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get intervention by ID' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.interventionsService.findOne(user, id);
  }
}
