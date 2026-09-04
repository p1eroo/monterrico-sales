import { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/notify';
import { formatVoiceTime, WAVEFORM_BAR_COUNT } from './VoiceRecorderBar';

interface AudioMessageContentProps {
  src?: string | null;
  isAgent: boolean;
  durationSeconds?: number | null;
}

function finiteDuration(value: number | undefined): number {
  if (!Number.isFinite(value) || !value || value <= 0) return 0;
  return value;
}

export function AudioMessageContent({ src, isAgent, durationSeconds }: AudioMessageContentProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(() =>
    durationSeconds && durationSeconds > 0 ? Math.round(durationSeconds) : 0,
  );

  useEffect(() => {
    const known = durationSeconds && durationSeconds > 0 ? Math.round(durationSeconds) : 0;
    setDuration(known);
    setPlaybackTime(0);
    setIsPlaying(false);
  }, [src, durationSeconds]);

  function applyDuration(audio: HTMLAudioElement) {
    const loaded = finiteDuration(audio.duration);
    if (loaded > 0) {
      setDuration((prev) => (prev > 0 ? prev : Math.max(1, Math.round(loaded))));
    }
  }

  function handleLoadedMetadata() {
    const audio = audioRef.current;
    if (!audio) return;
    applyDuration(audio);
    if ((durationSeconds ?? 0) > 0) return;
    // Chrome/Chromium no lee la duración de OGG/Opus de WhatsApp hasta hacer seek.
    if (!Number.isFinite(audio.duration) || audio.duration === Infinity) {
      unlockingRef.current = true;
      try {
        audio.currentTime = 1e101;
      } catch {
        unlockingRef.current = false;
      }
    }
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) return;
    if (unlockingRef.current) {
      applyDuration(audio);
      unlockingRef.current = false;
      audio.currentTime = 0;
      return;
    }
    setPlaybackTime(audio.currentTime);
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !src) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
      toast.error('No se pudo reproducir el audio');
    }
  }

  const progress = duration > 0 ? playbackTime / duration : 0;
  const activeIndex = Math.min(WAVEFORM_BAR_COUNT - 1, Math.floor(progress * WAVEFORM_BAR_COUNT));
  const displayDuration = duration
    ? formatVoiceTime(isPlaying || playbackTime > 0 ? Math.max(0, duration - Math.floor(playbackTime)) : duration)
    : '0:00';

  return (
    <div className="flex min-w-[200px] items-center gap-2.5">
      {src ? (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          className="sr-only"
          onLoadedMetadata={handleLoadedMetadata}
          onDurationChange={() => {
            if (audioRef.current) applyDuration(audioRef.current);
          }}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => {
            setIsPlaying(false);
            setPlaybackTime(0);
          }}
          onError={() => setIsPlaying(false)}
        />
      ) : null}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void togglePlayback();
        }}
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
