import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminService, Product } from '../admin.service';
import { ToastService } from '../toast.service';
import { ImageUrlPipe } from '../shared/image-url.pipe';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, RouterModule, ImageUrlPipe],
  templateUrl: './admin-products.html',
  styleUrl: './admin-products.css',
})
export class AdminProductsComponent implements OnInit {
  products: Product[] = [];
  isLoading = true;
  error: string | null = null;
  deletingId: number | null = null;

  private destroyRef = inject(DestroyRef);

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoading = true;
    this.error = null;

    this.adminService.getProducts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success) {
          this.products = res.products;
        }
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Σφάλμα φόρτωσης προϊόντων';
        this.isLoading = false;
      },
    });
  }

  deleteProduct(id: number, name: string): void {
    if (this.deletingId === id) return;
    if (!confirm(`Είσαι σίγουρος ότι θέλεις να διαγράψεις το "${name}";`)) {
      return;
    }

    this.deletingId = id;
    this.adminService.deleteProduct(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.deletingId = null;
        if (res.success) {
          this.products = this.products.filter((p) => p.id !== id);
          this.toastService.success(res.message || 'Το προϊόν διαγράφηκε!');
        } else {
          this.toastService.error(res.message || 'Αποτυχία διαγραφής');
        }
      },
      error: (err) => {
        this.deletingId = null;
        const errorMessage = err?.error?.message || err?.message || 'Αποτυχία διαγραφής προϊόντος';
        this.toastService.error(errorMessage);
      },
    });
  }
}