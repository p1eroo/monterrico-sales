import { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatVoiceTime, WAVEFORM_BAR_COUNT } from './VoiceRecorderBar';

interface AudioMessageContentProps {
  src?: string | null;
  isAgent: boolean;
}

export function AudioMessageContent({ src, isAgent }: AudioMessageContentProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!src) return;
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(Math.max(1, Math.round(audio.duration)));
      }
    };
    audio.onended = () => {
      setIsPlaying(false);
      setPlaybackTime(0);
    };
    audio.ontimeupdate = () => setPlaybackTime(audio.currentTime);
    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [src]);

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }

  const progress = duration > 0 ? playbackTime / duration : 0;
  const activeIndex = Math.min(WAVEFORM_BAR_COUNT - 1, Math.floor(progress * WAVEFORM_BAR_COUNT));
  const displayDuration = duration
    ? formatVoiceTime(isPlaying || playbackTime > 0 ? Math.max(0, duration - Math.floor(playbackTime)) : duration)
    : '0:00';

  return (
    <div className="flex min-w-[200px] items-center gap-2.5">
      <button
        type="button"
        onClick={togglePlayback}
        disabled={!src}
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
          isAgent ? 'bg-white/15 hover:bg-white/25' : 'bg-muted hover:bg-muted/80',
          !src && 'cursor-default opacity-70',
        )}
        title={src ? (isPlaying ? 'Pausar' : 'Reproducir') : 'Enviando audio…'}
      >
        {src ? (
          isPlaying ? (
            <Pause className="h-3.5 w-3.5 fill-current" />
          ) : (
            <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
          )
        ) : (
          <Mic className="h-3.5 w-3.5" />
        )}
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-[4px] overflow-hidden">
        {Array.from({ length: WAVEFORM_BAR_COUNT }).map((_, index) => (
          <span
            key={index}
            className={cn(
              'shrink-0 rounded-full',
              src && index === activeIndex
                ? 'h-1.5 w-1.5 bg-current opacity-100'
                : 'h-1 w-1 bg-current opacity-35',
            )}
          />
        ))}
      </div>

      <span className="shrink-0 text-[11px] tabular-nums opacity-80">
        {src ? displayDuration : '…'}
      </span>
    </div>
  );
}
