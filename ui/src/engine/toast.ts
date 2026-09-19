export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  createdAt: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();
  private counter = 0;

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener([...this.toasts]);
    }
  }

  public show(type: ToastType, message: string, duration = 3500): string {
    const id = `toast_${Date.now()}_${++this.counter}`;
    const item: ToastItem = {
      id,
      type,
      message,
      duration,
      createdAt: Date.now()
    };

    // Keep at most 5 toasts visible at once
    this.toasts = [...this.toasts.slice(-4), item];
    this.notify();

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  }

  public success(message: string, duration?: number): string {
    return this.show("success", message, duration);
  }

  public error(message: string, duration = 4500): string {
    return this.show("error", message, duration);
  }

  public info(message: string, duration?: number): string {
    return this.show("info", message, duration);
  }

  public warning(message: string, duration = 4000): string {
    return this.show("warning", message, duration);
  }

  public dismiss(id: string) {
    const idx = this.toasts.findIndex((t) => t.id === id);
    if (idx !== -1) {
      this.toasts.splice(idx, 1);
      this.notify();
    }
  }

  public clear() {
    this.toasts = [];
    this.notify();
  }
}

export const toast = new ToastManager();
