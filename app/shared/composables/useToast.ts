export type ToastTone = "success" | "danger" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  title?: string;
  tone: ToastTone;
}

export interface ToastOptions {
  title?: string;
  duration?: number;
}

const DEFAULT_DURATION = 5_000;

function createToastId(): string {
  return crypto.randomUUID();
}

/**
 * Shared, client-side notification queue. Toasts are owned by the Nuxt app
 * instance so they never leak between server-side rendered requests.
 */
export function useToast() {
  const toasts = useState<Toast[]>("toasts", () => []);

  function remove(id: string) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  function show(message: string, tone: ToastTone = "info", options: ToastOptions = {}) {
    const toast = {
      id: createToastId(),
      message,
      title: options.title,
      tone,
    } satisfies Toast;
    toasts.value.push(toast);

    const duration = options.duration ?? DEFAULT_DURATION;
    if (import.meta.client && duration > 0) {
      window.setTimeout(() => remove(toast.id), duration);
    }

    return toast.id;
  }

  function success(message: string, options?: ToastOptions) {
    return show(message, "success", options);
  }

  function error(message: string, options?: ToastOptions) {
    return show(message, "danger", options);
  }

  function warning(message: string, options?: ToastOptions) {
    return show(message, "warning", options);
  }

  function info(message: string, options?: ToastOptions) {
    return show(message, "info", options);
  }

  return { toasts, show, remove, success, error, warning, info };
}
