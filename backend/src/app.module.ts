import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { IncidentsModule } from './incidents/incidents.module';
import { PatientsModule } from './patients/patients.module';
import { VitalsModule } from './vitals/vitals.module';
import { InterventionsModule } from './interventions/interventions.module';
import { PhotosModule } from './photos/photos.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    UsersModule,
    IncidentsModule,
    PatientsModule,
    VitalsModule,
    InterventionsModule,
    PhotosModule,
    RealtimeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
