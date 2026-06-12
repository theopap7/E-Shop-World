import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.html',
  styleUrl: './toast.css'
})
export class ToastContainerComponent implements OnInit {

  toasts: Toast[] = [];

  private destroyRef = inject(DestroyRef);

  constructor(public toastService: ToastService) {}

  ngOnInit(): void {
    this.toastService.toasts$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(toasts => {
      this.toasts = toasts;
    });
  }

  getToastClass(type: string): string {
    return `toast toast-${type}`;
  }

  getIcon(type: string): string {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
      default: return 'ℹ';
    }
  }

  close(id: number): void {
    this.toastService.remove(id);
  }
}
