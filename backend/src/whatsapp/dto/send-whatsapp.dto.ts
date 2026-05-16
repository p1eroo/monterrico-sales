export class SendWhatsappDto {
  contactId?: string;
  text!: string;
  phone?: string;
  name?: string;
  /** Ver `WhatsappService.sendFromCrm` */
  instanceApiKey?: string;
}
