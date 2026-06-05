import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ProductListComponent } from '../product.list.component';
import { CartService } from '../cart.service';
import { AuthService } from '../auth.service';
import { WishlistService } from '../wishlist-service';


@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ProductListComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {
  cartCount = 0;
  isLoggedIn = false;

  private sub?: Subscription;
  private wishlistSub?: Subscription;

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private router: Router,
    private wishlistService: WishlistService,
  ) {}

wishlistCount = 0;  
  ngOnInit(): void {
    // 🔁 Cart badge (όπως πριν – ΔΕΝ το χαλάμε)
    this.sub = this.cartService.items$.subscribe(() => {
      this.cartCount = this.cartService.getCount();
    });
    this.cartCount = this.cartService.getCount();

    // 🔐 Auth state
    this.isLoggedIn = this.authService.isLoggedIn();
    this.wishlistSub = this.wishlistService.items$.subscribe(() => {
      this.wishlistCount = this.wishlistService.getCount();
    });
    this.wishlistCount = this.wishlistService.getCount();
    
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.wishlistSub?.unsubscribe();
  }
  // Method για toggle
toggleCart(): void {
  this.cartService.toggleSidebar();
}

  logout(): void {
    this.authService.logout();
    this.isLoggedIn = false;
    this.router.navigate(['/login']);
  }
}
