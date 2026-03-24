/**
 * Barrel file para componentes compartidos.
 * Permite: import { PageHeader, EmptyState } from '@/components/shared'
 */

export { ActivityFormDialog, type ActivityFormData, type ActivityResult } from './ActivityFormDialog';
export { ActivityPanel } from './ActivityPanel';
export { AssignDialog } from './AssignDialog';
export { ChangeEtapaDialog } from './ChangeEtapaDialog';
export { ConfirmDialog } from './ConfirmDialog';
export { DetailLayout } from './DetailLayout';
export { EmptyState } from './EmptyState';
export { ErrorBoundary } from './ErrorBoundary';
export { EntityInfoCard, type InfoField } from './EntityInfoCard';
export { GoalCard, type GoalPeriod } from './GoalCard';
export { LinkExistingDialog, type LinkExistingItem } from './LinkExistingDialog';
export { LinkedCompaniesCard } from './LinkedCompaniesCard';
export { LinkedContactsCard, type LinkedContact } from './LinkedContactsCard';
export { LinkedEntitiesCard, type LinkedEntitiesCardProps } from './LinkedEntitiesCard';
export { LinkedOpportunitiesCard } from './LinkedOpportunitiesCard';
export { MetricCard } from './MetricCard';
export { MonthlyGoalCard } from './MonthlyGoalCard';
export { NewCompanyWizard, type NewCompanyData } from './NewCompanyWizard';
export { NewContactWizard, type NewContactData } from './NewContactWizard';
export {
  NewOpportunityFormDialog,
  newOpportunityFormSchema,
  newOpportunityFormDefaults,
  buildOpportunityCreateBody,
  type NewOpportunityFormValues,
  type NewOpportunityFormDialogProps,
} from './NewOpportunityFormDialog';
export { PageHeader } from './PageHeader';
export { PriorityBadge } from './PriorityBadge';
export { QuickActionsBar } from './QuickActionsBar';
export { QuickActionsWithDialogs, type QuickTask } from './QuickActionsWithDialogs';
export { SelectDialog, type SelectDialogOption } from './SelectDialog';
export { StatusBadge } from './StatusBadge';
export { TaskDetailDialog, type TaskDetailTask, type TaskComment } from './TaskDetailDialog';
export { TaskFormDialog, type TaskFormResult, type TaskFormStatus, type TaskFormPriority, type TaskFormType } from './TaskFormDialog';
export { TasksTab, type TasksTabHandle } from './TasksTab';
export { ThemeToggle } from './ThemeToggle';
export { TimelinePanel } from './TimelinePanel';
export { WeeklyGoalCard } from './WeeklyGoalCard';
export { DailyBriefingPanel } from './DailyBriefingPanel';
