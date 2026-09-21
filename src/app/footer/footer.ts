import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class FooterComponent {
  year = new Date().getFullYear();
  isLoggedIn = false;

  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  constructor() {
    this.authService.user$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.isLoggedIn = this.authService.isLoggedIn();
    });
  }
}
