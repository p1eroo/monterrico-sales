export class SendWhatsappDto {
  contactId!: string;
  text!: string;
  /** Ver `WhatsappService.sendFromCrm` */
  instanceApiKey?: string;
}
