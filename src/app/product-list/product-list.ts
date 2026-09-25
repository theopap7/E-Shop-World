import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ProductService, ProductDto, Category } from '../services/product.service';
import { CartService } from '../services/cart.service';
import { ProductListStateService } from '../services/product-list-state.service';
import { ActivatedRoute, ParamMap, Params, Router, RouterModule } from '@angular/router';
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
  private urlSync$ = new Subject<void>();
  private lastQuery = '';

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private listState: ProductListStateService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const incoming = JSON.stringify(this.queryFromParamMap(params));
      if (incoming === this.lastQuery) return;
      this.applyQuery(params);
      this.lastQuery = JSON.stringify(this.buildQueryParams());
      this.listState.lastQueryParams = this.buildQueryParams();
    });

    this.urlSync$.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.writeUrl());

    this.fetchProducts();
    this.fetchCategories();
  }

  private queryFromParamMap(params: ParamMap): Params {
    const query: Params = {};
    for (const key of ['q', 'category', 'min', 'max', 'sort', 'page']) {
      const value = params.get(key);
      if (value !== null) query[key] = value;
    }
    return query;
  }

  private applyQuery(params: ParamMap): void {
    const toPrice = (value: string | null): number | null => {
      if (value === null || value.trim() === '') return null;
      const n = Number(value);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const page = Number(params.get('page'));

    this.searchTerm = params.get('q') ?? '';
    this.selectedCategory = params.get('category') ?? 'all';
    this.priceMin = toPrice(params.get('min'));
    this.priceMax = toPrice(params.get('max'));
    this.sortBy = params.get('sort') ?? 'newest';
    this.currentPage = Number.isInteger(page) && page > 1 ? page : 1;
  }

  private buildQueryParams(): Params {
    const query: Params = {};
    if (this.searchTerm.trim()) query['q'] = this.searchTerm.trim();
    if (this.selectedCategory !== 'all') query['category'] = this.selectedCategory;
    if (this.priceMin != null) query['min'] = String(this.priceMin);
    if (this.priceMax != null) query['max'] = String(this.priceMax);
    if (this.sortBy !== 'newest') query['sort'] = this.sortBy;
    if (this.currentPage > 1) query['page'] = String(this.currentPage);
    return query;
  }

  private syncUrl(immediate = false): void {
    this.listState.lastQueryParams = this.buildQueryParams();
    if (immediate) {
      this.writeUrl();
    } else {
      this.urlSync$.next();
    }
  }

  private writeUrl(): void {
    const query = this.buildQueryParams();
    const serialized = JSON.stringify(query);
    if (serialized === this.lastQuery) return;
    this.lastQuery = serialized;
    this.router.navigate([], { relativeTo: this.route, queryParams: query, replaceUrl: true });
  }

  fetchProducts(): void {
    this.errorMessage = '';
    this.productService.getProducts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.allProducts = res.products ?? [];
        this.isLoading = false;
        const maxPage = Math.max(1, Math.ceil(this.filteredProducts.length / this.pageSize));
        if (this.currentPage > maxPage) {
          this.currentPage = 1;
          this.syncUrl(true);
        }
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
    this.syncUrl();
  }

  onPriceMinCommit(): void {
    if (this.priceMin != null && this.priceMin < 0) {
      this.priceMin = 0;
    }
    if (this.priceMin != null && this.priceMax != null && this.priceMin > this.priceMax) {
      this.priceMax = this.priceMin;
    }
    this.syncUrl();
  }

  onPriceMaxCommit(): void {
    if (this.priceMax != null && this.priceMax < 0) {
      this.priceMax = 0;
    }
    if (this.priceMin != null && this.priceMax != null && this.priceMax < this.priceMin) {
      this.priceMin = this.priceMax;
    }
    this.syncUrl();
  }

  onSliderMinChange(value: number): void {
    this.priceMin = value > (this.priceMax ?? this.priceCeil) ? (this.priceMax ?? this.priceCeil) : value;
    this.currentPage = 1;
    this.syncUrl();
  }

  onSliderMaxChange(value: number): void {
    this.priceMax = value < (this.priceMin ?? this.priceFloor) ? (this.priceMin ?? this.priceFloor) : value;
    this.currentPage = 1;
    this.syncUrl();
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
    this.syncUrl();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.currentPage = 1;
    this.syncUrl(true);
  }

  onCategoryChange(): void {
    this.currentPage = 1;
    this.syncUrl(true);
  }

  onSortChange(): void {
    this.currentPage = 1;
    this.syncUrl(true);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.syncUrl(true);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = 'all';
    this.priceMin = null;
    this.priceMax = null;
    this.sortBy = 'newest';
    this.currentPage = 1;
    this.syncUrl(true);
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