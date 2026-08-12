import { ChatpoolInbox } from '@/components/flota/chatpool/ChatpoolInbox';

export default function FlotaChatpool() {
  return (
    <div className="flex min-h-0 flex-col -mb-5 md:-mb-6">
      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm h-[calc(100svh-8rem)] md:h-[calc(100svh-8.5rem)] min-h-[420px]">
        <ChatpoolInbox />
      </div>
    </div>
  );
}
