import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export interface ConfirmRequest extends ConfirmOptions {
  message: string;
  resolve: (result: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {

  private readonly requestSubject = new BehaviorSubject<ConfirmRequest | null>(null);
  readonly request$ = this.requestSubject.asObservable();

  confirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this.requestSubject.next({ message, resolve, ...options });
    });
  }

  respond(result: boolean): void {
    const current = this.requestSubject.value;
    if (!current) return;
    this.requestSubject.next(null);
    current.resolve(result);
  }
}
