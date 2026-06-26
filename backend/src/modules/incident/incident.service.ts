import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ReportIncidentDto, UpdateIncidentStatusDto } from './dto/incident.dto';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class IncidentService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async reportIncident(dto: ReportIncidentDto) {
    const site = await this.prisma.site.findUnique({ where: { id: dto.siteId } });
    if (!site) throw new NotFoundException('Site not found');

    const reporter = await this.prisma.guard.findUnique({ where: { id: dto.reporterId } });
    if (!reporter) throw new NotFoundException('Reporter not found');

    const incident = await this.prisma.incident.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        severity: dto.severity,
        status: 'OPEN',
        siteId: dto.siteId,
        reporterId: dto.reporterId,
        reportedAt: new Date(),
        location: JSON.stringify({ lat: dto.latitude, lng: dto.longitude }),
        mediaUrls: JSON.stringify(dto.mediaUrls || []),
        involvedParties: JSON.stringify(dto.involvedParties || []),
      },
    });

    // Broadcast real-time event to connected dashboards
    this.eventsGateway.broadcastIncident({
      id: incident.id,
      title: incident.title,
      type: incident.type,
      severity: incident.severity,
      siteName: site.name,
      reporterName: reporter.fullName,
      reportedAt: incident.reportedAt.toISOString(),
    });

    return incident;
  }

  async updateStatus(id: string, dto: UpdateIncidentStatusDto) {
    const incident = await this.prisma.incident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException('Incident not found');

    return this.prisma.incident.update({
      where: { id },
      data: {
        status: dto.status,
        resolutionNotes: dto.resolutionNotes,
      },
    });
  }

  async findAll(query: { page?: number; limit?: number; siteId?: string; status?: string; type?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.siteId) where.siteId = query.siteId;
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;

    const [data, total] = await Promise.all([
      this.prisma.incident.findMany({
        where, skip, take: limit, orderBy: { reportedAt: 'desc' },
        include: {
          site: { select: { id: true, name: true, client: { select: { companyName: true } } } },
          reporter: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.incident.count({ where }),
    ]);

    return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        site: { include: { client: true } },
        reporter: true,
      },
    });
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }
}
