import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';
import { ToastService } from '../toast.service';  

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class RegisterComponent {
  registerForm: FormGroup;
  showPassword = false;
  showConfirmPassword = false;
  isSubmitting = false;

  // ✅ INJECT ToastService
  constructor(
    private fb: FormBuilder, 
    private router: Router,
    private authService: AuthService,
    private toastService: ToastService  
  ) {
    this.registerForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, {
      validator: this.passwordMatchValidator
    });
  }

  passwordMatchValidator(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  onSubmit() {
    if (this.registerForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      const { firstName, lastName, email, password } = this.registerForm.value;

      this.authService.register(firstName, lastName, email, password).subscribe({
        next: (response: any) => {
          this.toastService.success('Η εγγραφή ολοκληρώθηκε επιτυχώς! 🎉');
          setTimeout(() => {
            this.toastService.info('Μπορείς να συνδεθείς τώρα');
          }, 500);
          this.isSubmitting = false;
          this.router.navigate(['/login']);
        },
        error: (error: any) => {
          const errorMsg = error?.error?.message || 'Σφάλμα εγγραφής. Δοκίμασε ξανά';
          this.toastService.error(errorMsg);
          this.isSubmitting = false;
        }
      });
    } else {
      // ✅ Toast: Validation errors
      if (this.registerForm.errors?.['mismatch']) {
        this.toastService.warning('Οι κωδικοί δεν ταιριάζουν');
      } else {
        this.toastService.warning('Παρακαλώ συμπλήρωσε όλα τα πεδία σωστά');
      }
    }
  }
}


















