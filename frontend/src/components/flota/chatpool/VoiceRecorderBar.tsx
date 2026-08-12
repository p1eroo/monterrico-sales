import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, Send, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const WAVEFORM_BAR_COUNT = 48;

export function formatVoiceTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export type VoiceRecordingResult = {
  blob: Blob;
  durationSeconds: number;
};

function resolveRecorderMimeType() {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) return 'audio/ogg;codecs=opus';
  return 'audio/webm';
}

interface VoiceRecorderBarProps {
  onSend: (result: VoiceRecordingResult) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}

export function VoiceRecorderBar({ onSend, onCancel, onError }: VoiceRecorderBarProps) {
  const [mode, setMode] = useState<'recording' | 'preview'>('recording');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: WAVEFORM_BAR_COUNT }, () => 0.15),
  );
  const [ready, setReady] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recordingStartRef = useRef(0);
  const elapsedRef = useRef(0);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopAnalyserLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const cleanupAudioContext = useCallback(() => {
    stopAnalyserLoop();
    void audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
  }, [stopAnalyserLoop]);

  const cleanupPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    blobRef.current = null;
    setIsPlaying(false);
    setPlaybackTime(0);
    setPreviewDuration(0);
  }, []);

  const hardCleanup = useCallback(() => {
    stopTimer();
    stopAnalyserLoop();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    cleanupStream();
    cleanupAudioContext();
    cleanupPreview();
  }, [cleanupAudioContext, cleanupPreview, cleanupStream, stopAnalyserLoop, stopTimer]);

  const setupPreviewAudio = useCallback(
    (blob: Blob, durationFallback: number) => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }

      blobRef.current = blob;
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      setPreviewDuration(Math.max(1, durationFallback));
      setElapsedSeconds(Math.max(1, durationFallback));

      audio.onloadedmetadata = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          const d = Math.max(1, Math.round(audio.duration));
          setPreviewDuration(d);
          setElapsedSeconds(d);
        }
      };
      audio.onended = () => {
        setIsPlaying(false);
        setPlaybackTime(0);
      };
      audio.ontimeupdate = () => setPlaybackTime(audio.currentTime);
    },
    [],
  );

  const finalizeRecorder = useCallback(
    (enterPreview: boolean) =>
      new Promise<VoiceRecordingResult | null>((resolve) => {
        const recorder = recorderRef.current;
        if (!recorder) {
          resolve(null);
          return;
        }

        stopTimer();
        stopAnalyserLoop();

        recorder.onstop = () => {
          const mimeType = recorder.mimeType || resolveRecorderMimeType();
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const durationSeconds = Math.max(
            1,
            Math.round((Date.now() - recordingStartRef.current) / 1000) || elapsedRef.current,
          );

          cleanupStream();
          cleanupAudioContext();
          recorderRef.current = null;

          if (blob.size === 0) {
            resolve(null);
            return;
          }

          if (enterPreview) {
            setupPreviewAudio(blob, durationSeconds);
            setMode('preview');
            resolve(null);
            return;
          }

          blobRef.current = blob;
          resolve({ blob, durationSeconds });
        };

        if (recorder.state !== 'inactive') {
          try {
            recorder.requestData();
          } catch {
            /* algunos browsers no soportan requestData en todos los estados */
          }
          recorder.stop();
        } else {
          resolve(null);
        }
      }),
    [cleanupAudioContext, cleanupStream, setupPreviewAudio, stopAnalyserLoop, stopTimer],
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        const audioContext = new AudioContext();
        if (audioContext.state === 'suspended') {
          await audioContext.resume().catch(() => {});
        }
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        analyserRef.current = analyser;

        const mimeType = resolveRecorderMimeType();
        const recorder = new MediaRecorder(stream, { mimeType });
        recorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        recorder.start(120);
        recordingStartRef.current = Date.now();
        elapsedRef.current = 0;
        setElapsedSeconds(0);
        setMode('recording');
        setReady(true);

        timerRef.current = setInterval(() => {
          const secs = Math.floor((Date.now() - recordingStartRef.current) / 1000);
          elapsedRef.current = secs;
          setElapsedSeconds(secs);
        }, 250);

        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const nextLevels: number[] = [];
          const step = Math.max(1, Math.floor(data.length / WAVEFORM_BAR_COUNT));
          for (let i = 0; i < WAVEFORM_BAR_COUNT; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) {
              sum += data[i * step + j] ?? 0;
            }
            const avg = sum / step / 255;
            nextLevels.push(Math.max(0.12, Math.min(1, avg * 2.8)));
          }
          setLevels(nextLevels);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        if (active) {
          onError('No se pudo acceder al micrófono');
          onCancel();
        }
      }
    })();

    return () => {
      active = false;
      hardCleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCancel() {
    hardCleanup();
    onCancel();
  }

  async function handlePause() {
    if (modeRef.current !== 'recording') return;
    await finalizeRecorder(true);
    // Tras pausar debe existir blob; si no, no hubo audio capturado
    if (!blobRef.current || blobRef.current.size === 0) {
      onError('La grabación está vacía. Habla un momento y vuelve a pausar.');
      handleCancel();
    }
  }

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

  async function handleSendClick() {
    if (modeRef.current === 'preview' && blobRef.current) {
      if (blobRef.current.size === 0) {
        onError('La grabación está vacía');
        return;
      }
      const duration = previewDuration || elapsedSeconds || 1;
      const blob = blobRef.current;
      // Detener preview audio sin revocar el blob aún
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      onSend({ blob, durationSeconds: duration });
      return;
    }

    if (modeRef.current === 'recording') {
      const result = await finalizeRecorder(false);
      if (!result || result.blob.size === 0) {
        onError('La grabación está vacía. Espera un segundo y vuelve a intentar.');
        return;
      }
      onSend(result);
      return;
    }

    onError('La grabación está vacía');
  }

  const isPreview = mode === 'preview';
  const displaySeconds = isPreview
    ? Math.max(0, Math.floor(previewDuration - playbackTime))
    : elapsedSeconds;
  const progress = isPreview && previewDuration > 0 ? playbackTime / previewDuration : 0;

  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <div className="flex min-h-[52px] flex-1 items-center gap-2.5 rounded-full border border-[#2a3942] bg-[#111b21] px-3 py-2">
        <button
          type="button"
          onClick={handleCancel}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#aebac1] transition-colors hover:bg-white/10 hover:text-white"
          title="Descartar"
        >
          <Trash2 className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>

        {isPreview ? (
          <button
            type="button"
            onClick={togglePlayback}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/30 text-white transition-colors hover:bg-white/10"
            title={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 fill-white" />
            ) : (
              <Play className="ml-0.5 h-4 w-4 fill-white" />
            )}
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff667f]" />
            <span className="min-w-[2.5rem] text-sm tabular-nums text-[#e9edef]">
              {formatVoiceTime(elapsedSeconds)}
            </span>
          </div>
        )}

        <div className="flex min-w-0 flex-1 items-center justify-center px-1">
          {isPreview ? <PreviewWaveform progress={progress} /> : <LiveWaveform levels={levels} />}
        </div>

        {isPreview ? (
          <>
            <span className="min-w-[2.5rem] shrink-0 text-right text-sm tabular-nums text-[#e9edef]">
              {formatVoiceTime(displaySeconds)}
            </span>
            <Mic className="h-[18px] w-[18px] shrink-0 text-[#ff667f]" strokeWidth={1.75} />
          </>
        ) : (
          <button
            type="button"
            onClick={() => void handlePause()}
            disabled={!ready}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#ff667f] transition-colors hover:bg-white/10 disabled:opacity-40"
            title="Pausar y escuchar"
          >
            <Pause className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => void handleSendClick()}
        disabled={!ready && !isPreview}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-[#111b21] shadow-md transition-all hover:bg-[#06cf9c] active:scale-95 disabled:opacity-40"
        title="Enviar audio"
      >
        <Send className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </button>
    </div>
  );
}

function LiveWaveform({ levels }: { levels: number[] }) {
  return (
    <div className="flex h-8 w-full items-center justify-center gap-[3px] overflow-hidden">
      {levels.map((level, index) => (
        <span
          key={index}
          className="w-[3px] rounded-full bg-[#8696a0] transition-[height] duration-75"
          style={{ height: `${Math.max(4, level * 28)}px` }}
        />
      ))}
    </div>
  );
}

function PreviewWaveform({ progress }: { progress: number }) {
  const activeIndex = Math.min(WAVEFORM_BAR_COUNT - 1, Math.floor(progress * WAVEFORM_BAR_COUNT));
  return (
    <div className="flex h-8 w-full items-center justify-center gap-[5px] overflow-hidden">
      {Array.from({ length: WAVEFORM_BAR_COUNT }).map((_, index) => (
        <span
          key={index}
          className={cn(
            'rounded-full transition-colors duration-150',
            index === activeIndex ? 'h-2 w-2 bg-[#00a884]' : 'h-1 w-1 bg-[#8696a0]',
          )}
        />
      ))}
    </div>
  );
}
