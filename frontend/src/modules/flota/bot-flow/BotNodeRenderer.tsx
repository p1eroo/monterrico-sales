import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import StartNode from './nodes/StartNode';
import MessageNode from './nodes/MessageNode';
import QuestionNode from './nodes/QuestionNode';
import ConditionNode from './nodes/ConditionNode';
import AiExtractNode from './nodes/AiExtractNode';
import CrmActionNode from './nodes/CrmActionNode';
import HumanHandoffNode from './nodes/HumanHandoffNode';
import EndNode from './nodes/EndNode';
import type { BotFlowNodeType } from './types';

const RENDERERS = {
  start: StartNode,
  message: MessageNode,
  question: QuestionNode,
  condition: ConditionNode,
  ai_extract: AiExtractNode,
  crm_action: CrmActionNode,
  human_handoff: HumanHandoffNode,
  end: EndNode,
} as const;

function BotNodeRendererFn(props: NodeProps<BotFlowNodeType>) {
  const Renderer = RENDERERS[props.data.nodeType];
  if (!Renderer) return null;
  if (!props.data.enabled) {
    return (
      <div className="opacity-40 grayscale">
        <Renderer {...props} />
      </div>
    );
  }
  return <Renderer {...props} />;
}

export const BotNodeRenderer = memo(BotNodeRendererFn);
