import { Component, DestroyRef, HostListener, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ConfirmService, ConfirmRequest } from '../services/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css'
})
export class ConfirmDialogComponent {

  request: ConfirmRequest | null = null;

  private destroyRef = inject(DestroyRef);

  constructor(private confirmService: ConfirmService) {
    this.confirmService.request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(request => {
      this.request = request;
    });
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (!this.request) return;
    event.preventDefault();
    this.confirmService.respond(false);
  }

  onConfirm(): void {
    this.confirmService.respond(true);
  }

  onCancel(): void {
    this.confirmService.respond(false);
  }
}
