import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-demo-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './demo-banner.html',
  styleUrl: './demo-banner.css'
})
export class DemoBannerComponent {
  readonly isDemo$;

  constructor(private authService: AuthService) {
    this.isDemo$ = this.authService.user$.pipe(map(user => user?.role === 'demo'));
  }
}
