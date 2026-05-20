import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminService, Product } from '../admin.service';
import { ToastService } from '../toast.service';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-products.html',
  styleUrl: './admin-products.css',
})
export class AdminProductsComponent implements OnInit {
  products: Product[] = [];
  isLoading = true;
  error: string | null = null;

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

    this.adminService.getProducts().subscribe({
      next: (res) => {
        if (res.success) {
          this.products = res.products;
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Load products error:', err);
        this.error = 'Failed to load products';
        this.isLoading = false;
      },
    });
  }

  deleteProduct(id: number, name: string): void {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    this.adminService.deleteProduct(id).subscribe({
      next: (res) => {
        if (res.success) {
          this.products = this.products.filter((p) => p.id !== id);
          this.toastService.success(res.message || 'Το προϊόν διαγράφηκε!');
        } else {
          this.toastService.error(res.message || 'Αποτυχία διαγραφής');
        }
      },
      error: (err) => {
        console.error('Delete product error:', err);
        const errorMessage = err?.error?.message || err?.message || 'Αποτυχία διαγραφής προϊόντος';
        this.toastService.error(errorMessage);
      },
    });
  }
}