import { memo } from 'react';
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import type { WorkflowEdgeData } from './flowTypes';

function WorkflowLabeledEdgeFn(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    selected,
    label,
    data,
  } = props;
  const edgeData = data as WorkflowEdgeData | undefined;
  const accent = edgeData?.accent ?? 'var(--muted-foreground)';
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  return (
    <BaseEdge
      id={id}
      path={path}
      labelX={labelX}
      labelY={labelY}
      label={typeof label === 'string' ? label : undefined}
      style={{
        stroke: selected ? 'var(--primary)' : accent,
        strokeWidth: selected ? 2.5 : 1.75,
      }}
      labelStyle={{
        fill: 'var(--foreground)',
        fontWeight: 600,
        fontSize: 11,
      }}
      labelShowBg
      labelBgStyle={{
        fill: selected
          ? 'color-mix(in srgb, var(--primary) 22%, transparent)'
          : 'color-mix(in srgb, var(--card) 94%, transparent)',
        stroke: selected
          ? 'color-mix(in srgb, var(--primary) 55%, transparent)'
          : 'var(--border)',
        strokeWidth: 1,
      }}
      labelBgPadding={[6, 4]}
      labelBgBorderRadius={6}
      interactionWidth={16}
    />
  );
}

export const WorkflowLabeledEdge = memo(WorkflowLabeledEdgeFn);
