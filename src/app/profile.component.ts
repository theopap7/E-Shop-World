import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, AuthUser } from './auth.service';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { ToastService } from './toast.service';
import { environment } from '../environments/environment';

@Component({
  standalone: true,
  selector: 'app-profile',
  imports: [CommonModule, FormsModule, RouterModule],
  styleUrl: './profile.component.css',
  templateUrl: './profile.component.html',
})
export class ProfileComponent {
  user: AuthUser | null;

  loading = false;

  currentPassword = '';
  newPassword = '';
  confirmPassword = ''; 
  passwordError: string | null = null;
  passwordSuccess: string | null = null;
  changingPassword = false;
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  // ✅ INJECT ToastService
  constructor(
    private auth: AuthService, 
    private http: HttpClient,
    private toastService: ToastService 
  ) {
    this.user = this.auth.getUser();
  }

  logout() {
    this.auth.logout();
    
    // ✅ Toast: Logout
    this.toastService.info('Αποσυνδέθηκες επιτυχώς 👋');
    
    location.href = '/login';
  }

  changePassword() {
    this.passwordSuccess = null;
    this.passwordError = null;

    // Έλεγχος συμπλήρωσης
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      // ✅ Toast: Missing fields
      this.toastService.warning('Συμπλήρωσε όλα τα πεδία');
      return;
    }

    // Έλεγχος επιβεβαίωσης
    if (this.newPassword !== this.confirmPassword) {
      // ✅ Toast: Password mismatch
      this.toastService.error('Οι κωδικοί δεν ταιριάζουν');
      return;
    }

    // Έλεγχος μήκους
    if (this.newPassword.length < 6) {
      // ✅ Toast: Too short
      this.toastService.warning('Ο νέος κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες');
      return;
    }

    this.changingPassword = true;

    this.http
      .post<any>(`${environment.apiUrl}/change-password`, {
        currentPassword: this.currentPassword,
        newPassword: this.newPassword,
      })
      .subscribe({
        next: () => {
          // ✅ Toast: Success
          this.toastService.success('Ο κωδικός άλλαξε επιτυχώς! 🔐');
          
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
          this.changingPassword = false;
        },
        error: (err) => {
          // ✅ Toast: Error
          const errorMsg = err?.error?.message || 'Σφάλμα αλλαγής κωδικού';
          this.toastService.error(errorMsg);
          
          this.changingPassword = false;
        },
      });
  }
}