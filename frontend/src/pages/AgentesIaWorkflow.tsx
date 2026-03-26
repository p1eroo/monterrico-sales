import { AgentWorkflowEditor } from '@/modules/agentes-ia/workflow/AgentWorkflowEditor';
import { Toaster } from '@/components/ui/sonner';

/** Shell sin MainLayout: lienzo del builder ocupa todo el viewport. */
export default function AgentesIaWorkflowPage() {
  return (
    <div className="fixed inset-0 z-[100] flex min-h-0 min-w-0 flex-col bg-background text-foreground">
      <AgentWorkflowEditor />
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
