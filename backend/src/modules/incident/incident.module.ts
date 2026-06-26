import { Module } from '@nestjs/common';
import { IncidentController } from './incident.controller';
import { IncidentService } from './incident.service';
import { CloudinaryService } from './cloudinary.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [IncidentController],
  providers: [IncidentService, CloudinaryService],
  exports: [IncidentService, CloudinaryService],
})
export class IncidentModule {}
