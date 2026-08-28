import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService, ProductDto, Category } from './product.service';
import { CartService } from './cart.service';
import { Router, RouterModule } from '@angular/router';
import { WishlistService } from './wishlist-service';
import { SkeletonComponent } from './skeleton/skeleton';
import { ImageUrlPipe } from './shared/image-url.pipe';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule ,
    SkeletonComponent,
    ImageUrlPipe
  ],
  templateUrl: './product.list.component.html',
  styleUrl: './product.list.component.css',
})
export class ProductListComponent implements OnInit {
  isLoading = true;
  errorMessage = '';
  allProducts: ProductDto[] = [];

  categories: Category[] = [];

  searchTerm = '';
  selectedCategory = 'all';
  readonly priceFloor = 0;
  readonly priceCeil = 2000;
  priceMin: number | null = null;
  priceMax: number | null = null;
  sortBy = 'newest';

  private destroyRef = inject(DestroyRef);

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.fetchProducts();
    this.fetchCategories();
  }

  fetchProducts(): void {
    this.errorMessage = '';
    this.productService.getProducts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.allProducts = res.products ?? [];
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Αποτυχία φόρτωσης προϊόντων. Δοκίμασε ξανά.';
        this.isLoading = false;
      },
    });
  }

  get priceMinPercent(): number {
    return this.toPercent(this.priceMin ?? this.priceFloor);
  }

  get priceMaxPercent(): number {
    return this.toPercent(this.priceMax ?? this.priceCeil);
  }

  private toPercent(value: number): number {
    const clamped = Math.min(Math.max(value, this.priceFloor), this.priceCeil);
    return ((clamped - this.priceFloor) / (this.priceCeil - this.priceFloor)) * 100;
  }

  onPriceMinChange(): void {
    if (this.priceMin != null && this.priceMin < 0) {
      this.priceMin = 0;
    }
    if (this.priceMin != null && this.priceMax != null && this.priceMin > this.priceMax) {
      this.priceMax = this.priceMin;
    }
  }

  onPriceMaxChange(): void {
    if (this.priceMax != null && this.priceMax < 0) {
      this.priceMax = 0;
    }
    if (this.priceMin != null && this.priceMax != null && this.priceMax < this.priceMin) {
      this.priceMin = this.priceMax;
    }
  }

  onSliderMinChange(value: number): void {
    this.priceMin = value > (this.priceMax ?? this.priceCeil) ? (this.priceMax ?? this.priceCeil) : value;
  }

  onSliderMaxChange(value: number): void {
    this.priceMax = value < (this.priceMin ?? this.priceFloor) ? (this.priceMin ?? this.priceFloor) : value;
  }

  fetchCategories(): void {
    this.productService.getCategories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.categories = res.categories ?? [];
      },
      error: () => {}
    });
  }

  get filteredProducts(): ProductDto[] {
    let result = [...this.allProducts]; // Copy!

    // 1. Search filter
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term) ||
        p.category_name?.toLowerCase().includes(term)
      );
    }

    // 2. Category filter
    if (this.selectedCategory !== 'all') {
      result = result.filter(p =>
        p.category_name === this.selectedCategory
      );
    }

    // 3. Price filter
    if (this.priceMin != null) {
      result = result.filter(p => p.price >= this.priceMin!);
    }
    if (this.priceMax != null) {
      result = result.filter(p => p.price <= this.priceMax!);
    }

    // 4. Sort
    switch (this.sortBy) {
      case 'price_asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'name_asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default: // newest
        result.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }

    return result;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = 'all';
    this.priceMin = null;
    this.priceMax = null;
    this.sortBy = 'newest';
  }

  addToCart(product: ProductDto): void {
    if (product.sizes?.length) {
      this.router.navigate(['/products', product.id]);
      return;
    }
    this.cartService.addToCart(product);
  }

  getStarClass(star: number, rating: number): string {
    if (star <= Math.floor(rating)) {
      return 'star-filled';
    } else if (star === Math.ceil(rating) && rating % 1 >= 0.5) {
      return 'star-half';
    } else {
      return 'star-empty';
    }
  }

  toggleWishlist(product: ProductDto, event: Event): void {
    event.stopPropagation();
    this.wishlistService.toggle(product);
  }

  isInWishlist(productId: number): boolean {
    return this.wishlistService.isInWishlist(productId);
  }

  cartQty(productId: number): number {
    return this.cartService.getItems()
      .filter(i => i.productId === productId)
      .reduce((sum, i) => sum + i.quantity, 0);
  }
}