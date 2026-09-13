import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { AuthService, AuthUser } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-email-verify-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './email-verify-banner.html',
  styleUrl: './email-verify-banner.css'
})
export class EmailVerifyBannerComponent implements OnInit {
  user: AuthUser | null = null;
  isSending = false;
  sent = false;

  private destroyRef = inject(DestroyRef);

  constructor(
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.authService.user$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(user => {
      this.user = user;
      if (user) this.sent = false;
    });
  }

  get showBanner(): boolean {
    return !!this.user && this.user.emailVerified === false;
  }

  resend(): void {
    if (!this.user || this.isSending) return;

    this.isSending = true;
    this.authService.resendVerification(this.user.email).subscribe({
      next: () => {
        this.isSending = false;
        this.sent = true;
        this.toastService.success('Στάλθηκε νέο email επιβεβαίωσης!');
      },
      error: (err) => {
        this.isSending = false;
        this.toastService.error(err.error?.message || 'Σφάλμα αποστολής email');
      }
    });
  }
}
