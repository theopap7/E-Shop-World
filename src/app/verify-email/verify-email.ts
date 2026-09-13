import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './verify-email.html',
  styleUrls: ['./verify-email.css']
})
export class VerifyEmailComponent implements OnInit {
  status: 'loading' | 'success' | 'error' | 'missing-token' = 'loading';
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.status = 'missing-token';
      return;
    }

    this.authService.verifyEmail(token).subscribe({
      next: () => {
        this.status = 'success';
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
}
