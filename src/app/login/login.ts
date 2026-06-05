import { Component } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { ToastService } from '../toast.service';  // ✅ ADD

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  loginForm: FormGroup;

  // ✅ INJECT ToastService
  constructor(
    private fb: FormBuilder, 
    private router: Router, 
    private authService: AuthService,
    private toastService: ToastService  // ✅ ADD
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  onSubmit() {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;

      this.authService.login(email, password).subscribe({
        next: (response: any) => {
          this.toastService.success('Καλώς ήρθες πίσω! 👋');
          
          this.router.navigate(['/dashboard']);
        },
        error: (error: any) => {
          if (error.status === 429) {
            this.toastService.error(error.error?.message || 'Πολλές αποτυχημένες προσπάθειες. Δοκιμάστε ξανά σε 15 λεπτά.');
          } else {
            this.toastService.error('Λάθος email ή κωδικός πρόσβασης');
          }
        }
      });
    } else {
      // ✅ Toast: Validation error
      this.toastService.warning('Παρακαλώ συμπλήρωσε όλα τα πεδία σωστά');
    }
  }
}