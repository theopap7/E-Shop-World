import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { WishlistService } from '../services/wishlist.service';
import { CartService } from '../services/cart.service';
import { ConfirmService } from '../services/confirm.service';
import { ProductDto } from '../services/product.service';
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
    private cartService: CartService,
    private router: Router,
    private confirmService: ConfirmService
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
    if (product.sizes?.length) {
      this.router.navigate(['/products', product.id]);
      return;
    }
    this.cartService.addToCart(product);
    this.cartService.openSidebar();
  }

  async clearAll(): Promise<void> {
    const ok = await this.confirmService.confirm('Διαγραφή όλων των αγαπημένων;', { danger: true });
    if (ok) {
      this.wishlistService.clear();
    }
  }
}
