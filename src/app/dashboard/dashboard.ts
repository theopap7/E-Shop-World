import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ProductListComponent } from '../product.list.component';
import { CartService } from '../cart.service';
import { AuthService } from '../auth.service';
import { WishlistService } from '../wishlist-service';
import { ToastService } from '../toast.service';


@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ProductListComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  cartCount = 0;
  isLoggedIn = false;
  wishlistCount = 0;

  private destroyRef = inject(DestroyRef);

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private router: Router,
    private wishlistService: WishlistService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.cartService.items$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.cartCount = this.cartService.getCount();
    });
    this.cartCount = this.cartService.getCount();

    this.authService.user$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(user => {
      this.isLoggedIn = !!user;
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
