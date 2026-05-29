import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FlowToolbarProps {
  onClick: () => void;
}

export default function FlowToolbar({ onClick }: FlowToolbarProps) {
  return (
    <Button
      size="sm"
      className="h-9 w-9 rounded-lg bg-primary p-0 text-primary-foreground hover:bg-primary/90"
      onClick={onClick}
    >
      <Plus className="size-5" />
    </Button>
  );
}
