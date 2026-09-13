import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, AuthUser } from '../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { ToastService } from '../services/toast.service';
import { environment } from '../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-profile',
  imports: [CommonModule, FormsModule, RouterModule],
  styleUrl: './profile.css',
  templateUrl: './profile.html',
})
export class ProfileComponent {
  user: AuthUser | null;

  loading = false;

  // Edit profile state
  editMode = false;
  isUpdating = false;
  editForm = {
    firstName: '', lastName: '', email: '', phone: '',
    address: { country: 'ΕΛΛΑΔΑ', city: '', zip: '', address1: '', floor: '' }
  };

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  changingPassword = false;
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  constructor(
    private auth: AuthService,
    private http: HttpClient,
    private toastService: ToastService,
    private router: Router
  ) {
    this.user = this.auth.getUser();
  }

  startEdit(): void {
    if (!this.user) return;
    this.editForm = {
      firstName: this.user.firstName,
      lastName: this.user.lastName,
      email: this.user.email,
      phone: this.user.phone || '',
      address: {
        country: this.user.address?.country || 'ΕΛΛΑΔΑ',
        city: this.user.address?.city || '',
        zip: this.user.address?.zip || '',
        address1: this.user.address?.address1 || '',
        floor: this.user.address?.floor || ''
      }
    };
    this.editMode = true;
  }

  cancelEdit(): void {
    this.editMode = false;
  }

  updateProfile(): void {
    const { firstName, lastName, email, phone, address } = this.editForm;
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      this.toastService.warning('Συμπλήρωσε όλα τα πεδία');
      return;
    }

    const phoneRegex = /^(\+30|0030)?[269]\d{9}$/;
    if (phone.trim() && !phoneRegex.test(phone.trim())) {
      this.toastService.warning('Μη έγκυρο τηλέφωνο (π.χ. 6912345678 ή +306912345678)');
      return;
    }

    this.isUpdating = true;
    this.http.put<{ success: boolean; user: AuthUser }>(`${environment.apiUrl}/me`, { firstName, lastName, email, phone, address }).subscribe({
      next: (res) => {
        if (res.success) {
          this.auth.updateUser(res.user);
          this.user = res.user;
          this.editMode = false;
          this.toastService.success('Το προφίλ ενημερώθηκε επιτυχώς!');
        }
        this.isUpdating = false;
      },
      error: (err) => {
        this.toastService.error(err.error?.message || 'Σφάλμα ενημέρωσης προφίλ');
        this.isUpdating = false;
      }
    });
  }

  logout() {
    this.auth.logout();
    this.toastService.info('Αποσυνδέθηκες επιτυχώς 👋');
    this.router.navigate(['/login']);
  }

  changePassword() {
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.toastService.warning('Συμπλήρωσε όλα τα πεδία');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.toastService.error('Οι κωδικοί δεν ταιριάζουν');
      return;
    }

    if (this.newPassword.length < 8) {
      this.toastService.warning('Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες');
      return;
    }

    this.changingPassword = true;

    this.http
      .post<{ success: boolean; message?: string }>(`${environment.apiUrl}/change-password`, {
        currentPassword: this.currentPassword,
        newPassword: this.newPassword,
      })
      .subscribe({
        next: () => {
          this.toastService.success('Ο κωδικός άλλαξε επιτυχώς! 🔐');
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
          this.changingPassword = false;
        },
        error: (err) => {
          const errorMsg = err?.error?.message || 'Σφάλμα αλλαγής κωδικού';
          this.toastService.error(errorMsg);
          this.changingPassword = false;
        },
      });
  }
}