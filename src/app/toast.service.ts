import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

// ===== TYPES =====

// Toast Type: Καθορίζει το στυλ (success/error/info/warning)
export type ToastType = 'success' | 'error' | 'info' | 'warning';

// Toast Interface: Η δομή ενός toast message
export interface Toast {
  id: number;           // Unique identifier
  type: ToastType;      // success/error/info/warning
  message: string;      // Το μήνυμα που θα δει ο user
  duration?: number;    // Πόσο θα μείνει (ms), default 3000
}
// ===== SERVICE =====

@Injectable({ providedIn: 'root' })
export class ToastService {
  
  private readonly toastsSubject = new BehaviorSubject<Toast[]>([]);
  readonly toasts$ = this.toastsSubject.asObservable();
  private idCounter = 0;

  constructor() {}

  success(message: string, duration = 3000): void {
    this.show('success', message, duration);
  }

  error(message: string, duration = 4000): void {
    this.show('error', message, duration);
  }

  info(message: string, duration = 3000): void {
    this.show('info', message, duration);
  }

  warning(message: string, duration = 3500): void {
    this.show('warning', message, duration);
  }

  remove(id: number): void {
    const current = this.toastsSubject.value;
    const filtered = current.filter(t => t.id !== id);
    this.toastsSubject.next(filtered);
  }

  clear(): void {
    this.toastsSubject.next([]);
  }

  private show(type: ToastType, message: string, duration: number): void {
    const toast: Toast = {
      id: ++this.idCounter,
      type,
      message,
      duration
    };

    const current = this.toastsSubject.value;
    this.toastsSubject.next([...current, toast]);

    setTimeout(() => {
      this.remove(toast.id);
    }, duration);
  }
}
