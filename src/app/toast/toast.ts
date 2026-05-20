import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastService, Toast } from '../toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.html',
  styleUrl: './toast.css'
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  
  toasts: Toast[] = [];
  private sub?: Subscription;

  constructor(public toastService: ToastService) {}

  ngOnInit(): void {
    // Subscribe to toast changes
    this.sub = this.toastService.toasts$.subscribe(toasts => {
      this.toasts = toasts;
    });
  }

  ngOnDestroy(): void {
    // Cleanup
    this.sub?.unsubscribe();
  }

  /**
   * Get CSS class based on toast type
   */
  getToastClass(type: string): string {
    return `toast toast-${type}`;
  }

  /**
   * Get icon based on toast type
   */
  getIcon(type: string): string {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
      default: return 'ℹ';
    }
  }

  /**
   * User clicks X to close
   */
  close(id: number): void {
    this.toastService.remove(id);
  }
}