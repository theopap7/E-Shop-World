import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService, ProductDto, ProductFilters } from './product.service';
import { CartService } from './cart.service';
import { RouterModule } from '@angular/router';
import { WishlistService } from './wishlist-service';
import { SkeletonComponent } from './skeleton/skeleton';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule, 
    RouterModule ,  
    SkeletonComponent
  ],
  templateUrl: './product.list.component.html',
  styleUrl: './product.list.component.css',
})
export class ProductListComponent implements OnInit {
  isLoading = true;
  errorMessage = '';
  allProducts: ProductDto[] = [];

  // ✅ ΝΕΟ: Categories για dropdown
  categories: any[] = [];

  // ✅ ΝΕΟ: Filter state
  searchTerm = '';
  selectedCategory = 'all';
  priceMax = 9999;
  sortBy = 'newest';

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private wishlistService: WishlistService
  ) {}

  ngOnInit(): void {
    this.fetchProducts();
    this.fetchCategories();
  }

  // ✅ Updated: φορτώνει χωρίς filters (frontend filtering)
  fetchProducts(): void {
    this.errorMessage = '';
    this.productService.getProducts().subscribe({
      next: (res) => {
        this.allProducts = res.products ?? [];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('GET /api/products failed:', err);
        this.errorMessage = 'Αποτυχία φόρτωσης προϊόντων. Δοκίμασε ξανά.';
        this.isLoading = false;
      },
    });
  }

  // ✅ ΝΕΟ: Φόρτωσε κατηγορίες
  fetchCategories(): void {
    this.productService.getCategories().subscribe({
      next: (res) => {
        this.categories = res.categories ?? [];
      },
      error: (err) => {
        console.error('GET /api/categories failed:', err);
      }
    });
  }

  // ✅ ΝΕΟ: Computed property - derived state
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
    result = result.filter(p => p.price <= this.priceMax);

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

  // ✅ ΝΕΟ: Reset όλα τα filters
  resetFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = 'all';
    this.priceMax = 9999;
    this.sortBy = 'newest';
  }

  // ✅ Existing: addToCart (δεν αλλάζει!)
  addToCart(product: ProductDto): void {
    this.cartService.addToCart(product);
  }
  // Μέσα στην class ProductListComponent:

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
  event.stopPropagation();  // Αποφεύγει navigation στο detail page
  this.wishlistService.toggle(product);
}

isInWishlist(productId: number): boolean {
  return this.wishlistService.isInWishlist(productId);
}
}