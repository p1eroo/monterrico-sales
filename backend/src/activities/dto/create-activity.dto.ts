export class CreateActivityDto {
  type!: string;
  title!: string;
  description?: string;
  assignedTo!: string;
  dueDate!: string;
  startDate?: string;
  startTime?: string;
  contactId?: string;
  companyId?: string;
  opportunityId?: string;
}
