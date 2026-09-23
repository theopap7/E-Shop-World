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
import { STAR_CLASSES, starFill } from '../shared/star-fill';

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
  error = false;
  fromProfile = false;

  private destroyRef = inject(DestroyRef);

  constructor(
    public wishlistService: WishlistService,
    private cartService: CartService,
    private router: Router,
    private confirmService: ConfirmService
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.fromProfile = history.state?.from === 'profile';

    this.wishlistService.items$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(items => {
      this.items = items;
      this.isLoading = false;
    });

    this.wishlistService.loadError$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(hasError => {
      this.error = hasError;
      if (hasError) this.isLoading = false;
    });
  }

  starClass(star: number, rating: number | string | null): string {
    return STAR_CLASSES[starFill(star, rating)];
  }

  retry(): void {
    this.isLoading = true;
    this.wishlistService.reload();
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
    const ok = await this.confirmService.confirm('Να αφαιρεθούν όλα τα προϊόντα από τα αγαπημένα;', { danger: true, confirmText: 'Αφαίρεση όλων' });
    if (ok) {
      this.wishlistService.clear();
    }
  }
}
