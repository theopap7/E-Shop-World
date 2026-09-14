import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ProductService, ProductDto, ProductImage } from '../services/product.service';
import { CartService } from '../services/cart.service';
import { WishlistService } from '../services/wishlist.service';
import { ReviewsComponent } from '../reviews/reviews';
import { BreadcrumbService } from '../services/breadcrumb.service';
import { SkeletonComponent } from '../skeleton/skeleton';
import { ImageUrlPipe } from '../shared/image-url.pipe';
import { RecentlyViewedService, RecentlyViewedProduct } from '../services/recently-viewed.service';
import { sortSizes } from '../services/size-order.util';

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
  relatedProducts: ProductDto[] = [];
  recentlyViewed: RecentlyViewedProduct[] = [];
  addedToCart = false;
  selectedQty = 1;
  selectedSize: string | null = null;

  get availableStock(): number {
    if (!this.product) return 0;
    if (this.sizes.length > 0) {
      return this.selectedSize ? (this.product.sizeStock?.[this.selectedSize] ?? 0) : 0;
    }
    return this.product.stock;
  }

  get qtyOptions(): number[] {
    if (this.availableStock <= 0) return [];
    return Array.from({ length: Math.min(this.availableStock, 100) }, (_, i) => i + 1);
  }

  get sizes(): string[] {
    return sortSizes(this.product?.sizes ?? []);
  }

  isSizeAvailable(size: string): boolean {
    return (this.product?.sizeStock?.[size] ?? 0) > 0;
  }

  sizeStockOf(size: string): number {
    return this.product?.sizeStock?.[size] ?? 0;
  }

  sizeStockLabel(size: string): string {
    const qty = this.sizeStockOf(size);
    if (qty === 0) return 'Εξαντλήθηκε';
    if (qty === 1) return 'Τελευταίο κομμάτι';
    return '';
  }

  selectSize(size: string): void {
    if (!this.isSizeAvailable(size)) return;
    this.selectedSize = size;
    this.selectedQty = 1;
  }

  get canAddToCart(): boolean {
    if (!this.product) return false;
    if (this.sizes.length > 0 && !this.selectedSize) return false;
    return this.availableStock > 0;
  }

  private destroyRef = inject(DestroyRef);

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private router: Router,
    private breadcrumbService: BreadcrumbService,
    private recentlyViewedService: RecentlyViewedService
  ) {}

  isInWishlist(): boolean {
    return this.product ? this.wishlistService.isInWishlist(this.product.id) : false;
  }

  toggleWishlist(): void {
    if (this.product) this.wishlistService.toggle(this.product);
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = Number(params.get('id'));

      if (!Number.isFinite(id)) {
        this.router.navigate(['/dashboard']);
        return;
      }

      this.loadProduct(id);
    });
  }

  loadProduct(id: number): void {
    this.isLoading = true;
    this.error = '';
    this.selectedQty = 1;
    this.selectedSize = null;
    this.relatedProducts = [];
    this.recentlyViewed = [];

    this.productService.getProduct(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res?.success) {
          this.product = res.product;
          this.galleryImages = res.galleryImages ?? [];
          this.activeImageUrl = this.product.image_url;

          if (this.product?.name) {
            this.breadcrumbService.updateLastBreadcrumb(this.product.name);
          }

          this.loadRelatedProducts();

          this.recentlyViewedService.track(this.product);
          this.recentlyViewed = this.recentlyViewedService.getRecent(this.product.id);
        } else {
          this.error = 'Το προϊόν δεν βρέθηκε.';
        }

        this.isLoading = false;

        if (this.route.snapshot.fragment === 'reviews') {
          setTimeout(() => {
            document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }
      },
      error: (err: { status: number }) => {
        this.error = err?.status === 404
          ? 'Το προϊόν δεν βρέθηκε.'
          : 'Σφάλμα φόρτωσης προϊόντος.';
        this.isLoading = false;
      }
    });
  }

  loadRelatedProducts(): void {
    if (!this.product?.category_name) {
      this.relatedProducts = [];
      return;
    }

    this.productService.getProducts({ category: this.product.category_name })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res?.success) {
            this.relatedProducts = res.products
              .filter(p => p.id !== this.product!.id)
              .slice(0, 4);
          }
        },
        error: () => {
          this.relatedProducts = [];
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