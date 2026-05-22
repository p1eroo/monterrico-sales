import { PageHeader } from '@/components/shared/PageHeader';

export default function MarketingDashboard() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Marketing"
        description="Panel de marketing"
      />
      <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-16">
        <p className="text-sm text-muted-foreground">
          Módulo de Marketing — Próximamente
        </p>
      </div>
    </div>
  );
}
