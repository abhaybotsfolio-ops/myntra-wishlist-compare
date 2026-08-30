/**
 * Minimal pub/sub so both components and plain lib code (Zustand actions,
 * the inventory poller) can raise a toast without prop-drilling or a new
 * dependency. `ToastProvider` in components/ui/Toast.tsx is the only
 * subscriber. Not app state — nothing here is persisted or in AppState.
 */
export type ToastTone = "neutral" | "warning" | "negative";

export interface ToastMessage {
  id: string;
  text: string;
  tone: ToastTone;
  durationMs: number;
}

type Listener = (toast: ToastMessage) => void;

const listeners = new Set<Listener>();
let counter = 0;

export function showToast(
  text: string,
  opts: { tone?: ToastTone; durationMs?: number } = {},
): string {
  counter += 1;
  const toast: ToastMessage = {
    id: `toast-${counter}-${Date.now()}`,
    text,
    tone: opts.tone ?? "neutral",
    durationMs: opts.durationMs ?? 3200,
  };
  listeners.forEach((listen) => listen(toast));
  return toast.id;
}

export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
