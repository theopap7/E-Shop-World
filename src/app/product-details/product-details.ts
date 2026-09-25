import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterModule } from '@angular/router';
import { EMPTY, Subject, combineLatest } from 'rxjs';
import { switchMap, catchError, takeUntil, startWith } from 'rxjs/operators';
import { ProductService, ProductDto, ProductImage } from '../services/product.service';
import { CartService } from '../services/cart.service';
import { WishlistService } from '../services/wishlist.service';
import { ReviewsComponent } from '../reviews/reviews';
import { BreadcrumbService } from '../services/breadcrumb.service';
import { SkeletonComponent } from '../skeleton/skeleton';
import { ImageUrlPipe } from '../shared/image-url.pipe';
import { RecentlyViewedService, RecentlyViewedProduct } from '../services/recently-viewed.service';
import { sortSizes } from '../services/size-order.util';
import { ProductListStateService } from '../services/product-list-state.service';

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
  isLoadingRelated = false;
  recentlyViewed: RecentlyViewedProduct[] = [];
  addedToCart = false;
  selectedQty = 1;
  selectedSize: string | null = null;
  notFound = false;
  private cancelRelated$ = new Subject<void>();
  private retry$ = new Subject<void>();

  retry(): void {
    this.retry$.next();
  }

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
    private recentlyViewedService: RecentlyViewedService,
    private listState: ProductListStateService
  ) {}

  get listQueryParams(): Params {
    return this.listState.lastQueryParams;
  }

  isInWishlist(): boolean {
    return this.product ? this.wishlistService.isInWishlist(this.product.id) : false;
  }

  toggleWishlist(): void {
    if (this.product) this.wishlistService.toggle(this.product);
  }

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.retry$.pipe(startWith(undefined))]).pipe(
      switchMap(([params]) => {
        const id = Number(params.get('id'));

        if (!Number.isFinite(id)) {
          this.router.navigate(['/dashboard']);
          return EMPTY;
        }

        this.isLoading = true;
        this.error = '';
        this.notFound = false;
        this.product = null;
        this.galleryImages = [];
        this.selectedQty = 1;
        this.selectedSize = null;
        this.relatedProducts = [];
        this.recentlyViewed = [];
        this.cancelRelated$.next();

        return this.productService.getProduct(id).pipe(
          catchError((err: { status: number }) => {
            if (err?.status === 404) {
              this.recentlyViewedService.remove(id);
              this.notFound = true;
            }
            this.error = err?.status === 404
              ? 'Το προϊόν δεν βρέθηκε.'
              : 'Σφάλμα φόρτωσης προϊόντος.';
            this.isLoading = false;
            return EMPTY;
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(res => {
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
        this.recentlyViewedService.refreshRecent(this.product.id)
          .pipe(takeUntil(this.cancelRelated$), takeUntilDestroyed(this.destroyRef))
          .subscribe(list => this.recentlyViewed = list);
      } else {
        this.error = 'Το προϊόν δεν βρέθηκε.';
      }

      this.isLoading = false;

      if (this.route.snapshot.fragment === 'reviews') {
        setTimeout(() => {
          document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    });
  }

  loadRelatedProducts(): void {
    if (!this.product) {
      this.relatedProducts = [];
      return;
    }

    this.isLoadingRelated = true;

    this.productService.getRelatedProducts(this.product.id)
      .pipe(takeUntil(this.cancelRelated$), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.relatedProducts = res?.success ? res.products : [];
          this.isLoadingRelated = false;
        },
        error: () => {
          this.relatedProducts = [];
          this.isLoadingRelated = false;
        }
      });
  }

  addToCart(): void {
    if (!this.product || !this.canAddToCart) return;

    const added = this.cartService.addToCart(this.product, this.selectedQty, this.selectedSize ?? undefined);
    if (!added) return;
    this.addedToCart = true;
    this.cartService.openSidebar();

    setTimeout(() => {
      this.addedToCart = false;
    }, 2000);
  }
}