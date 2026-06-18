import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AdminService, AdminOrder } from '../admin.service';
import { ToastService } from '../toast.service';
import { statusLabel } from '../order-status.util';
import { PaginationComponent } from '../shared/pagination/pagination.component';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PaginationComponent],
  templateUrl: './admin-orders.html',
  styleUrl: './admin-orders.css',
})
export class AdminOrdersComponent implements OnInit {

  orders: AdminOrder[] = [];
  isLoading = true;
  error: string | null = null;
  updatingId: number | null = null;
  activeFilter = 'all';
  searchTerm = '';
  currentPage = 1;
  readonly pageSize = 20;

  readonly filters = [
    { key: 'all',        label: 'Όλες' },
    { key: 'pending',    label: 'Σε αναμονή' },
    { key: 'processing', label: 'Σε επεξεργασία' },
    { key: 'shipped',    label: 'Απεστάλη' },
    { key: 'delivered',  label: 'Παραδόθηκε' },
    { key: 'cancelled',  label: 'Ακυρώθηκε' },
  ];

  get searchFilteredOrders(): AdminOrder[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.orders;
    return this.orders.filter(o =>
      `#${o.id}`.includes(term) ||
      o.first_name?.toLowerCase().includes(term) ||
      o.last_name?.toLowerCase().includes(term) ||
      o.user_email?.toLowerCase().includes(term)
    );
  }

  get filteredOrders(): AdminOrder[] {
    if (this.activeFilter === 'all') return this.searchFilteredOrders;
    return this.searchFilteredOrders.filter(o => o.status === this.activeFilter);
  }

  get pagedOrders(): AdminOrder[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredOrders.slice(start, start + this.pageSize);
  }

  onFilterChange(key: string): void {
    this.activeFilter = key;
    this.currentPage = 1;
  }

  onSearchChange(): void {
    this.currentPage = 1;
  }

  count(key: string): number {
    if (key === 'all') return this.searchFilteredOrders.length;
    return this.searchFilteredOrders.filter(o => o.status === key).length;
  }

  private destroyRef = inject(DestroyRef);

  constructor(
    private adminService: AdminService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.isLoading = true;
    this.error = null;

    this.adminService.getOrders().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success) {
          this.orders = res.orders.sort((a: AdminOrder, b: AdminOrder) =>
            a.status === 'pending' && b.status !== 'pending' ? -1 :
            a.status !== 'pending' && b.status === 'pending' ? 1 : 0
          );
        }
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Σφάλμα φόρτωσης παραγγελιών';
        this.isLoading = false;
      },
    });
  }

  updateStatus(orderId: number, newStatus: string): void {
    if (this.updatingId === orderId) return;

    if (newStatus === 'cancelled' && !confirm(`Είσαι σίγουρος ότι θέλεις να ακυρώσεις την παραγγελία #${orderId}; Αυτή η ενέργεια δεν αναιρείται.`)) {
      const order = this.orders.find(o => o.id === orderId);
      if (order) {
        const prev = order.status;
        order.status = '';
        setTimeout(() => order.status = prev, 0);
      }
      return;
    }

    this.updatingId = orderId;
    this.adminService.updateOrderStatus(orderId, newStatus).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success) {
          const order = this.orders.find((o) => o.id === orderId);
          if (order) order.status = newStatus;
          this.toastService.success('Κατάσταση παραγγελίας ενημερώθηκε!');
        }
        this.updatingId = null;
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'Αποτυχία ενημέρωσης κατάστασης');
        this.updatingId = null;
      },
    });
  }

  // 🔵 CLICKABLE ROW NAVIGATION
  goToOrder(orderId: number): void {
    this.router.navigate(['/admin/orders', orderId]);
  }

  statusLabel = statusLabel;

}