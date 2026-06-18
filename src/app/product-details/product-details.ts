import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ProductService, ProductDto, ProductImage } from '../product.service';
import { CartService } from '../cart.service';
import { WishlistService } from '../wishlist-service';
import { ReviewsComponent } from '../reviews/reviews';
import { BreadcrumbService } from '../breadcrumb.service';
import { SkeletonComponent } from '../skeleton/skeleton';
import { ImageUrlPipe } from '../shared/image-url.pipe';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ReviewsComponent, SkeletonComponent, ImageUrlPipe],
  templateUrl: './product-details.html',
  styleUrl: './product-details.css'
})
export class ProductDetailComponent implements OnInit {

  product: ProductDto | null = null;
  galleryImages: ProductImage[] = [];
  activeImageUrl: string | null = null;
  isLoading = true;
  error = '';
  addedToCart = false;
  selectedQty = 1;
  selectedSize: string | null = null;

  get qtyOptions(): number[] {
    if (!this.product || this.product.stock <= 0) return [];
    return Array.from({ length: Math.min(this.product.stock, 100) }, (_, i) => i + 1);
  }

  get sizes(): string[] {
    return this.product?.sizes ?? [];
  }

  get canAddToCart(): boolean {
    if (!this.product || this.product.stock === 0) return false;
    if (this.sizes.length > 0 && !this.selectedSize) return false;
    return true;
  }

  private destroyRef = inject(DestroyRef);

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private router: Router,
    private breadcrumbService: BreadcrumbService
  ) {}

  isInWishlist(): boolean {
    return this.product ? this.wishlistService.isInWishlist(this.product.id) : false;
  }

  toggleWishlist(): void {
    if (this.product) this.wishlistService.toggle(this.product);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.loadProduct(Number(id));
  }

  loadProduct(id: number): void {
    this.isLoading = true;
    this.error = '';

    this.productService.getProduct(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res?.success) {
          this.product = res.product;
          this.galleryImages = res.galleryImages ?? [];
          this.activeImageUrl = this.product.image_url;

          if (this.product?.name) {
            this.breadcrumbService.updateLastBreadcrumb(this.product.name);
          }
        } else {
          this.error = 'Το προϊόν δεν βρέθηκε.';
        }

        this.isLoading = false;
      },
      error: (err: { status: number }) => {
        this.error = err?.status === 404
          ? 'Το προϊόν δεν βρέθηκε.'
          : 'Σφάλμα φόρτωσης προϊόντος.';
        this.isLoading = false;
      }
    });
  }

  addToCart(): void {
    if (!this.product || !this.canAddToCart) return;

    this.cartService.addToCart(this.product, this.selectedQty, this.selectedSize ?? undefined);
    this.addedToCart = true;
    this.cartService.openSidebar();

    setTimeout(() => {
      this.addedToCart = false;
    }, 2000);
  }
}