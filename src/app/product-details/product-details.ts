import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ProductService, ProductDto } from '../product.service';
import { CartService } from '../cart.service';
import { ReviewsComponent } from '../reviews/reviews';
import { BreadcrumbService } from '../breadcrumb.service';
import { SkeletonComponent } from '../skeleton/skeleton';


@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ReviewsComponent,  SkeletonComponent],
  templateUrl: './product-details.html',
  styleUrl: './product-details.css'
})
export class ProductDetailComponent implements OnInit {

  product: ProductDto | null = null;
  isLoading = true;
  error = '';
  addedToCart = false;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private cartService: CartService,
    private router: Router,
    private breadcrumbService: BreadcrumbService
  ) {}

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

    this.productService.getProduct(id).subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.product = res.product;

          // ✅ update breadcrumb label with actual product name
          if (this.product?.name) {
            this.breadcrumbService.updateLastBreadcrumb(this.product.name);
          }
        } else {
          this.error = 'Το προϊόν δεν βρέθηκε.';
        }

        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Load product error:', err);
        this.error = err?.status === 404
          ? 'Το προϊόν δεν βρέθηκε.'
          : 'Σφάλμα φόρτωσης προϊόντος.';
        this.isLoading = false;
      }
    });
  }

  addToCart(): void {
    if (!this.product) return;

    this.cartService.addToCart(this.product);
    this.addedToCart = true;

    // ✅ Άνοιξε το sidebar
    this.cartService.openSidebar();

    setTimeout(() => {
      this.addedToCart = false;
    }, 2000);
  }
}