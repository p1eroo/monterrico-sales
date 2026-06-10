import EmojiPicker, { type EmojiClickData, type Theme } from 'emoji-picker-react';
import { useTheme } from 'next-themes';

interface EmojiGridProps {
  onSelect: (emoji: string) => void;
}

export function EmojiGrid({ onSelect }: EmojiGridProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div className="overflow-hidden" style={{ width: 300, height: 380 }}>
      <EmojiPicker
        onEmojiClick={(emojiData: EmojiClickData) => onSelect(emojiData.emoji)}
        theme={(resolvedTheme === 'dark' ? 'dark' : 'light') as Theme}
        skinTonesDisabled
        searchDisabled={false}
        width={300}
        height={380}
      />
    </div>
  );
}
