import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './verify-email.html',
  styleUrls: ['./verify-email.css']
})
export class VerifyEmailComponent implements OnInit {
  status: 'loading' | 'success' | 'error' | 'missing-token' = 'loading';
  errorMessage = '';
  alreadyVerified = false;
  email = '';
  isSending = false;
  resent = false;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.email = this.authService.getUser()?.email ?? '';
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.status = 'missing-token';
      return;
    }

    this.authService.verifyEmail(token).subscribe({
      next: (res) => {
        this.status = 'success';
        this.alreadyVerified = !!res.alreadyVerified;
        const user = this.authService.getUser();
        if (user) {
          this.authService.updateUser({ ...user, emailVerified: true });
        }
      },
      error: (err) => {
        this.status = 'error';
        this.errorMessage = err.error?.message || 'Ο σύνδεσμος δεν είναι έγκυρος ή έχει λήξει.';
      }
    });
  }

  resend(): void {
    const email = this.email.trim();
    if (!email || this.isSending) return;

    this.isSending = true;
    this.authService.resendVerification(email).subscribe({
      next: () => {
        this.isSending = false;
        this.resent = true;
      },
      error: (err) => {
        this.isSending = false;
        this.toastService.error(err.error?.message || 'Σφάλμα αποστολής email');
      }
    });
  }
}
