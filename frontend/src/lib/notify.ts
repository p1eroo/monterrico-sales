import { toast as sonnerToast, type ExternalToast } from 'sonner';

/**
 * Capa de notificaciones sobre Sonner (motor de toasts).
 * Importar siempre desde aquí: `import { toast, notify } from '@/lib/notify'`
 */
export type { ExternalToast };

const DEFAULT_DESCRIPTIONS = {
  success: 'La operación se completó correctamente',
  error: 'Revisa los datos e inténtalo de nuevo',
  warning: 'Verifica la información antes de continuar',
  loading: 'Por favor espera un momento',
} as const;

type ToastType = keyof typeof DEFAULT_DESCRIPTIONS;

function withDefaultDescription(type: ToastType, data?: ExternalToast): ExternalToast | undefined {
  if (data?.description) return data;
  const description = DEFAULT_DESCRIPTIONS[type];
  if (!description) return data;
  return { ...data, description };
}

/** API unificada: misma firma que Sonner, con descripción por defecto en success/error/warning/loading. */
export const toast = {
  ...sonnerToast,
  success(message: string, data?: ExternalToast) {
    return sonnerToast.success(message, withDefaultDescription('success', data));
  },
  error(message: string, data?: ExternalToast) {
    return sonnerToast.error(message, withDefaultDescription('error', data));
  },
  warning(message: string, data?: ExternalToast) {
    return sonnerToast.warning(message, withDefaultDescription('warning', data));
  },
  loading(message: string, data?: ExternalToast) {
    return sonnerToast.loading(message, withDefaultDescription('loading', data));
  },
  info: sonnerToast.info,
  message: sonnerToast.message,
  promise: sonnerToast.promise,
  dismiss: sonnerToast.dismiss,
  custom: sonnerToast.custom,
};

type NotifyOptions = ExternalToast;

function buildOptions(description?: string, options?: NotifyOptions): NotifyOptions | undefined {
  if (!description && !options) return undefined;
  return { ...options, ...(description ? { description } : {}) };
}

/** Toasts con título y descripción explícitos (sobreescribe el texto por defecto). */
export const notify = {
  success(title: string, description?: string, options?: NotifyOptions) {
    return sonnerToast.success(title, buildOptions(description, options));
  },
  error(title: string, description?: string, options?: NotifyOptions) {
    return sonnerToast.error(title, buildOptions(description, options));
  },
  warning(title: string, description?: string, options?: NotifyOptions) {
    return sonnerToast.warning(title, buildOptions(description, options));
  },
  info(title: string, description?: string, options?: NotifyOptions) {
    return sonnerToast.info(title, buildOptions(description, options));
  },
  loading(title: string, description?: string, options?: NotifyOptions) {
    return sonnerToast.loading(title, buildOptions(description, options));
  },
  dismiss: sonnerToast.dismiss,
  promise: sonnerToast.promise,
  message: sonnerToast.message,
};
