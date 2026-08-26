import type { WhatsAppBulkCampaign } from '@/lib/marketingApi';
import type { WhatsAppSendResult, WhatsAppSendStatus } from './mockData';

export function campaignRecipientsToSendResults(campaign: WhatsAppBulkCampaign): WhatsAppSendResult[] {
  return campaign.recipients.map((r) => {
    let status: WhatsAppSendStatus = 'enviado';
    if (r.status === 'failed') status = 'fallido';
    else if (r.status === 'sent') status = 'enviado';

    return {
      contactId: r.id,
      name: r.name ?? 'Sin nombre',
      phone: r.phone,
      status,
      error: r.error ?? undefined,
      sentAt: r.sentAt ?? campaign.completedAt ?? campaign.createdAt,
    };
  });
}
