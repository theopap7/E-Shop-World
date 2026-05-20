import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { WishlistService } from '../wishlist-service';
import { CartService } from '../cart.service';
import { ProductDto } from '../product.service';
import { SkeletonComponent } from '../skeleton/skeleton';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SkeletonComponent
  ],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css'
})
export class WishlistComponent implements OnInit, OnDestroy {

  items: ProductDto[] = [];
  isLoading = true;   // ✅ loading state
  private sub?: Subscription;

  constructor(
    public wishlistService: WishlistService,
    private cartService: CartService
  ) {}

  ngOnInit(): void {

    // δείχνουμε skeleton στην αρχή
    this.isLoading = true;

    this.sub = this.wishlistService.items$.subscribe(items => {
      this.items = items;

      // μικρό delay για smooth skeleton UX
      setTimeout(() => {
        this.isLoading = false;
      }, 500);
    });

  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  remove(productId: number): void {
    this.wishlistService.remove(productId);
  }

  addToCart(product: ProductDto): void {
    this.cartService.addToCart(product);
    this.cartService.openSidebar();
  }

  clearAll(): void {
    if (confirm('Διαγραφή όλων των αγαπημένων;')) {
      this.wishlistService.clear();
    }
  }

}