import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService, ProductDto, Category } from '../services/product.service';
import { CartService } from '../services/cart.service';
import { Router, RouterModule } from '@angular/router';
import { WishlistService } from '../services/wishlist.service';
import { SkeletonComponent } from '../skeleton/skeleton';
import { ImageUrlPipe } from '../shared/image-url.pipe';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { STAR_CLASSES, starFill } from '../shared/star-fill';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule ,
    SkeletonComponent,
    ImageUrlPipe,
    PaginationComponent
  ],
  templateUrl: './product-list.html',
  styleUrl: './product-list.css',
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

  currentPage = 1;
  readonly pageSize = 20;

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
        this.errorMessage = 'Αποτυχία φόρτωσης προϊόντων.';
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

  onPriceChange(): void {
    this.currentPage = 1;
  }

  onPriceMinCommit(): void {
    if (this.priceMin != null && this.priceMin < 0) {
      this.priceMin = 0;
    }
    if (this.priceMin != null && this.priceMax != null && this.priceMin > this.priceMax) {
      this.priceMax = this.priceMin;
    }
  }

  onPriceMaxCommit(): void {
    if (this.priceMax != null && this.priceMax < 0) {
      this.priceMax = 0;
    }
    if (this.priceMin != null && this.priceMax != null && this.priceMax < this.priceMin) {
      this.priceMin = this.priceMax;
    }
  }

  onSliderMinChange(value: number): void {
    this.priceMin = value > (this.priceMax ?? this.priceCeil) ? (this.priceMax ?? this.priceCeil) : value;
    this.currentPage = 1;
  }

  onSliderMaxChange(value: number): void {
    this.priceMax = value < (this.priceMin ?? this.priceFloor) ? (this.priceMin ?? this.priceFloor) : value;
    this.currentPage = 1;
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
    let result = [...this.allProducts];

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term) ||
        p.category_name?.toLowerCase().includes(term)
      );
    }

    if (this.selectedCategory !== 'all') {
      result = result.filter(p =>
        p.category_name === this.selectedCategory
      );
    }

    if (this.priceMin != null) {
      result = result.filter(p => p.price >= this.priceMin!);
    }
    if (this.priceMax != null) {
      result = result.filter(p => p.price <= this.priceMax!);
    }

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
      default:
        result.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }

    return result;
  }

  get pagedProducts(): ProductDto[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredProducts.slice(start, start + this.pageSize);
  }

  onSearchChange(): void {
    this.currentPage = 1;
  }

  onCategoryChange(): void {
    this.currentPage = 1;
  }

  onSortChange(): void {
    this.currentPage = 1;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = 'all';
    this.priceMin = null;
    this.priceMax = null;
    this.sortBy = 'newest';
    this.currentPage = 1;
  }

  addToCart(product: ProductDto): void {
    if (product.sizes?.length) {
      this.router.navigate(['/products', product.id]);
      return;
    }
    this.cartService.addToCart(product);
  }

  getStarClass(star: number, rating: number | string | null): string {
    return STAR_CLASSES[starFill(star, rating)];
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