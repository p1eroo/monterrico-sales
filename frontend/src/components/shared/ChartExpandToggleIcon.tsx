import { SquareBottomUpSvgIcon } from '@/components/icons/SquareBottomUpSvgIcon';
import { SquareTopUpSvgIcon } from '@/components/icons/SquareTopUpSvgIcon';

export const chartExpandIconClass = 'size-6 shrink-0';
export const chartReduceIconClass = 'size-6 shrink-0';

export const chartCardHeaderClass =
  'flex flex-row items-center justify-between space-y-0 gap-2';

type ChartExpandToggleIconProps = {
  expanded?: boolean;
  className?: string;
};

export function ChartExpandToggleIcon({
  expanded = false,
  className = chartExpandIconClass,
}: ChartExpandToggleIconProps) {
  return expanded ? (
    <SquareTopUpSvgIcon className={className} />
  ) : (
    <SquareBottomUpSvgIcon className={className} />
  );
}
