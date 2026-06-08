import { useMemo } from 'react';
import { getStageBadgeTone, type StageBadgeTone } from '@/lib/etapaConfig';
import { useCrmConfigStore } from '@/store/crmConfigStore';

export function useStageBadgeTone(slug: string | null | undefined): StageBadgeTone {
  const bundle = useCrmConfigStore((s) => s.bundle);
  return useMemo(() => getStageBadgeTone(bundle, slug), [bundle, slug]);
}
