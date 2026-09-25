import { Component } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { EyeIconComponent } from '../shared/eye-icon/eye-icon.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, EyeIconComponent],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  showPassword = false;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private toastService: ToastService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  onSubmit() {
    if (this.loginForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      const { email, password } = this.loginForm.value;

      this.authService.login(email, password).subscribe({
        next: () => {
          this.toastService.success('Καλώς ήρθες πίσω! 👋');
          this.isSubmitting = false;
          const raw = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
          const returnUrl = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';
          this.router.navigateByUrl(returnUrl);
        },
        error: (error: { status: number; error?: { message?: string } }) => {
          this.isSubmitting = false;
          if (error.status === 429) {
            this.toastService.error(error.error?.message || 'Πολλές αποτυχημένες προσπάθειες. Δοκίμασε ξανά σε 10 λεπτά.');
          } else if (error.status === 401) {
            this.toastService.error('Λάθος email ή κωδικός πρόσβασης');
          } else if (error.status === 0 || error.status >= 500) {
            this.toastService.error('Ο διακομιστής δεν απαντά. Δοκίμασε ξανά σε λίγο.');
          } else {
            this.toastService.error(error.error?.message || 'Η σύνδεση απέτυχε. Δοκίμασε ξανά.');
          }
        }
      });
    } else if (!this.isSubmitting) {
      this.loginForm.markAllAsTouched();
      this.toastService.warning('Παρακαλώ συμπλήρωσε όλα τα πεδία σωστά');
    }
  }
}