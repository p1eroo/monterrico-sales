export class SendWhatsappDto {
  contactId?: string;
  text!: string;
  phone?: string;
  name?: string;
  imageUrl?: string;
  flotaProspectoId?: string;
  /** Ver `WhatsappService.sendFromCrm` */
  instanceApiKey?: string;
}
