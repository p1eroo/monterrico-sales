import { Fragment } from 'react';

function renderInline(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function AssistantMessageBody({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          const content = trimmed.replace(/^[-•]\s+/, '');
          return (
            <div key={i} className="flex gap-2 pl-0.5">
              <span className="text-muted-foreground select-none">•</span>
              <span className="min-w-0 flex-1">{renderInline(content)}</span>
            </div>
          );
        }
        if (trimmed === '') {
          return <div key={i} className="h-1" />;
        }
        return (
          <p key={i} className="min-w-0">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}
