import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AdminService, AdminOrder } from '../admin.service';
import { ToastService } from '../toast.service';
import { statusLabel } from '../order-status.util';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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

  readonly filters = [
    { key: 'all',        label: 'Όλες' },
    { key: 'pending',    label: 'Σε αναμονή' },
    { key: 'processing', label: 'Σε επεξεργασία' },
    { key: 'shipped',    label: 'Απεστάλη' },
    { key: 'delivered',  label: 'Παραδόθηκε' },
    { key: 'cancelled',  label: 'Ακυρώθηκε' },
  ];

  get filteredOrders(): AdminOrder[] {
    let result = this.activeFilter === 'all'
      ? this.orders
      : this.orders.filter(o => o.status === this.activeFilter);

    const term = this.searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(o =>
        `#${o.id}`.includes(term) ||
        o.first_name?.toLowerCase().includes(term) ||
        o.last_name?.toLowerCase().includes(term) ||
        o.user_email?.toLowerCase().includes(term)
      );
    }

    return result;
  }

  count(key: string): number {
    if (key === 'all') return this.orders.length;
    return this.orders.filter(o => o.status === key).length;
  }

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

    this.adminService.getOrders().subscribe({
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
    this.adminService.updateOrderStatus(orderId, newStatus).subscribe({
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