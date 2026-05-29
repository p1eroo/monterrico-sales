import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AutomationSidebar from './AutomationSidebar';
import DashboardView from './DashboardView';
import BotListView from './BotListView';
import BotFlowBuilder from './BotFlowBuilder';
import BotBrainConfig from './BotBrainConfig';
import BotTrainingView from './BotTrainingView';
import BotKnowledgeBase from './BotKnowledgeBase';
import BotConversationsView from './BotConversationsView';
import BotStatsView from './BotStatsView';
import BotLogsView from './BotLogsView';
import BotGlobalConfig from './BotGlobalConfig';
import { createMockFlow } from './mockData';
import type { AutomationSection, BotAgent } from './types';

export default function AutomationLayout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [section, setSection] = useState<AutomationSection>(() => {
    const s = searchParams.get('section');
    if (s === 'dashboard' || s === 'agentes' || s === 'cerebro' || s === 'entrenamiento' || s === 'conocimiento' || s === 'conversaciones' || s === 'estadisticas' || s === 'logs' || s === 'configuracion') return s;
    return 'dashboard';
  });
  const [selectedBotAgent, setSelectedBotAgent] = useState<BotAgent | null>(null);

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('section', section);
      return next;
    }, { replace: true });
  }, [section, setSearchParams]);

  const renderContent = () => {
    if (selectedBotAgent) {
      return (
        <>
          <div className="flex min-h-0 flex-1 flex-col">
            <BotFlowBuilder botAgent={selectedBotAgent} onBack={() => setSelectedBotAgent(null)} />
          </div>
        </>
      );
    }

    switch (section) {
      case 'dashboard':
        return <DashboardView />;
      case 'agentes':
        return (
          <BotListView
            onEdit={(agent) => setSelectedBotAgent(agent)}
            onNew={(data) => {
              setSelectedBotAgent({
                id: `bot-new-${Date.now()}`,
                name: data.name,
                description: data.description,
                status: 'draft',
                channel: data.channel,
                brainMode: data.brainMode,
                activeConversations: 0,
                totalConversations: 0,
                conversionRate: 0,
                handoffRate: 0,
                lastUpdated: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                flow: { id: `flow-new-${Date.now()}`, name: data.name, description: data.description, status: 'draft', nodes: createMockFlow().nodes, edges: createMockFlow().edges },
              });
            }}
          />
        );
      case 'cerebro':
        return <BotBrainConfig />;
      case 'entrenamiento':
        return <BotTrainingView />;
      case 'conocimiento':
        return <BotKnowledgeBase />;
      case 'conversaciones':
        return <BotConversationsView />;
      case 'estadisticas':
        return <BotStatsView />;
      case 'logs':
        return <BotLogsView />;
      case 'configuracion':
        return <BotGlobalConfig />;
    }
  };

  return (
    <div className="flex min-h-0 flex-1">
      {!selectedBotAgent && (
        <AutomationSidebar activeSection={section} onSelect={(s) => { setSection(s); setSelectedBotAgent(null); }} />
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
}
