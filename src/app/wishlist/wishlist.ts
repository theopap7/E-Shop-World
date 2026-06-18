import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { WishlistService } from '../wishlist-service';
import { CartService } from '../cart.service';
import { ProductDto } from '../product.service';
import { SkeletonComponent } from '../skeleton/skeleton';
import { ImageUrlPipe } from '../shared/image-url.pipe';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SkeletonComponent,
    ImageUrlPipe
  ],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css'
})
export class WishlistComponent implements OnInit {

  items: ProductDto[] = [];
  isLoading = true;

  private destroyRef = inject(DestroyRef);

  constructor(
    public wishlistService: WishlistService,
    private cartService: CartService
  ) {}

  ngOnInit(): void {
    this.isLoading = true;

    this.wishlistService.items$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(items => {
      this.items = items;
      this.isLoading = false;
    });
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
