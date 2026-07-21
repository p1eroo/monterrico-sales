import { InfoCircleSvgIcon } from '@/components/icons/InfoCircleSvgIcon';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type ChartInfoTooltipProps = {
  description: string;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
};

export function ChartInfoTooltip({
  description,
  className,
  side = 'top',
}: ChartInfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex shrink-0 items-center justify-center text-[#72808f] transition-colors hover:text-[#5f707f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-gray-500 dark:hover:text-gray-400',
            className,
          )}
          aria-label="Más información"
        >
          <InfoCircleSvgIcon className="size-[22px] shrink-0" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={6}
        className="max-w-[260px] text-left leading-relaxed"
      >
        {description}
      </TooltipContent>
    </Tooltip>
  );
}
