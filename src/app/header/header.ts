import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { CartService } from '../services/cart.service';
import { AuthService } from '../services/auth.service';
import { WishlistService } from '../services/wishlist.service';
import { ToastService } from '../services/toast.service';

const AUTH_ONLY_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class HeaderComponent implements OnInit {
  cartCount = 0;
  isLoggedIn = false;
  isAdmin = false;
  wishlistCount = 0;
  isAuthPage = false;

  private destroyRef = inject(DestroyRef);

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private router: Router,
    private wishlistService: WishlistService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.isAuthPage = AUTH_ONLY_PATHS.some(p => this.router.url.startsWith(p));
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(e => {
      this.isAuthPage = AUTH_ONLY_PATHS.some(p => e.urlAfterRedirects.startsWith(p));
    });

    this.cartService.items$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.cartCount = this.cartService.getCount();
    });
    this.cartCount = this.cartService.getCount();

    this.authService.user$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.isLoggedIn = this.authService.isLoggedIn();
      this.isAdmin = this.isLoggedIn && this.authService.isAdmin();
    });

    this.wishlistService.items$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.wishlistCount = this.wishlistService.getCount();
    });
    this.wishlistCount = this.wishlistService.getCount();
  }

  toggleCart(): void {
    this.cartService.toggleSidebar();
  }

  logout(): void {
    this.authService.logout();
    this.isLoggedIn = false;
    this.toastService.info('Αποσυνδέθηκες επιτυχώς 👋');
    this.router.navigate(['/login']);
  }
}
