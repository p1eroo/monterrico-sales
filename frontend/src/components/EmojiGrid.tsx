import { cn } from '@/lib/utils';

const EMOJIS = [
  '😀','😂','🤣','😊','😍','🥰','😘','😜','🤪','😎',
  '🤩','🥳','😢','😭','😤','😡','🤬','😱','😨','😰',
  '👍','👎','👏','🙌','🤝','💪','🙏','✌️','🤞','👌',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💕',
  '🔥','⭐','✨','🎉','🎊','🏆','💰','📢','✅','❌',
  '🚕','🚗','📍','📱','💻','⏰','📅','📋','🛑','⚠️',
  '🍗','☕','🎂','🍕','🌮','🥤','🍺',
];

interface EmojiGridProps {
  onSelect: (emoji: string) => void;
  className?: string;
}

export function EmojiGrid({ onSelect, className }: EmojiGridProps) {
  return (
    <div className={cn('grid grid-cols-10 gap-1 p-2', className)}>
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-muted transition-colors"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
