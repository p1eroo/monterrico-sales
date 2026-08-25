import CampaignBuilderShell from '@/components/shared/CampaignBuilderShell';
import { crmAudienceSource } from '@/lib/campaignAudience';

export default function CampaignBuilderPage() {
  return <CampaignBuilderShell source={crmAudienceSource} permission="campanas.crear" />;
}
