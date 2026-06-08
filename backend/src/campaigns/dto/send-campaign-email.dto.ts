export class CampaignEmailRecipientDto {
  id!: string;
  email!: string;
  name!: string;
  company?: string;
  contactId?: string;
}

export class CampaignEmailAttachmentDto {
  fileName!: string;
  mimeType?: string;
  /** Base64 sin prefijo data:... */
  contentBase64!: string;
}

export class SendCampaignEmailDto {
  campaignName?: string;
  subject!: string;
  htmlBody!: string;
  recipients!: CampaignEmailRecipientDto[];
  attachments?: CampaignEmailAttachmentDto[];
}
