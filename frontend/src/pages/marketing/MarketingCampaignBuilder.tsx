import CampaignBuilderShell from '@/components/shared/CampaignBuilderShell';
import { leadsAudienceSource } from '@/lib/campaignAudience';

export default function MarketingCampaignBuilderPage() {
  return (
    <CampaignBuilderShell
      source={leadsAudienceSource}
      basePath="/marketing/campaigns"
    />
  );
}
