import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { slugifyForUrl } from '../common/url-slug.util';
import { CreateWebLeadDto } from './dto/create-web-lead.dto';

@Injectable()
export class WebLeadsService {
  private readonly logger = new Logger(WebLeadsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWebLeadDto) {
    const name = dto.name?.trim() || '';
    const company = dto.company?.trim() || '';
    const email = dto.email?.trim() || '';
    const phone = dto.phone?.trim() || '';

    if (!name && !company) {
      throw new BadRequestException('Debes enviar al menos nombre o empresa');
    }

    const digits = company.replace(/\D/g, '');
    const ruc = digits.length === 11 ? digits : null;
    const domain = email.includes('@')
      ? email.split('@')[1]?.trim() || null
      : null;

    const result = await this.prisma.$transaction(async (tx) => {
      let companyId: string | null = null;
      let contactId: string | null = null;
      let opportunityId: string | null = null;

      if (company) {
        const companySlug = await this.nextSlug(tx, 'company', company);
        const createdCompany = await tx.company.create({
          data: {
            urlSlug: companySlug,
            name: company,
            ruc,
            domain,
            correo: email || null,
            telefono: phone || null,
            facturacionEstimada: 0,
            fuente: 'marketing',
            etapa: 'lead',
          },
        });
        companyId = createdCompany.id;
      }

      if (name) {
        const contactSlug = await this.nextSlug(tx, 'contact', name);
        const createdContact = await tx.contact.create({
          data: {
            urlSlug: contactSlug,
            name,
            telefono: phone,
            correo: email,
            fuente: 'marketing',
            etapa: 'lead',
            estimatedValue: 0,
          },
        });
        contactId = createdContact.id;
      }

      if (companyId) {
        const title = `Reunión - ${company}`;
        const opportunitySlug = await this.nextSlug(tx, 'opportunity', title);
        const createdOpportunity = await tx.opportunity.create({
          data: {
            urlSlug: opportunitySlug,
            title,
            amount: 0,
            etapa: 'lead',
            status: 'abierta',
            priority: 'media',
            fuente: 'marketing',
          },
        });
        opportunityId = createdOpportunity.id;

        await tx.companyOpportunity.create({
          data: { companyId, opportunityId: createdOpportunity.id },
        });

        if (contactId) {
          await tx.companyContact.create({
            data: { companyId, contactId, isPrimary: true },
          });
          await tx.contactOpportunity.create({
            data: { contactId, opportunityId: createdOpportunity.id },
          });
        }
      }

      return { companyId, contactId, opportunityId };
    });

    this.logger.log(
      `Web lead creado: contact=${result.contactId ?? '—'} company=${result.companyId ?? '—'} opportunity=${result.opportunityId ?? '—'}`,
    );

    return { status: 'ok', ...result };
  }

  private async nextSlug(
    tx: Prisma.TransactionClient,
    table: 'contact' | 'company' | 'opportunity',
    source: string,
  ): Promise<string> {
    const base = slugifyForUrl(source);
    let candidate = base;
    let n = 0;
    for (;;) {
      let exists = false;
      if (table === 'contact') {
        exists = !!(await tx.contact.findFirst({
          where: { urlSlug: candidate },
          select: { id: true },
        }));
      } else if (table === 'company') {
        exists = !!(await tx.company.findFirst({
          where: { urlSlug: candidate },
          select: { id: true },
        }));
      } else {
        exists = !!(await tx.opportunity.findFirst({
          where: { urlSlug: candidate },
          select: { id: true },
        }));
      }
      if (!exists) return candidate;
      n += 1;
      candidate = `${base}-${n}`;
    }
  }
}
