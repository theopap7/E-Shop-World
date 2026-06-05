import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AdminService, AdminOrder } from '../admin.service';
import { ToastService } from '../toast.service';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-orders.html',
  styleUrl: './admin-orders.css',
})
export class AdminOrdersComponent implements OnInit {

  orders: AdminOrder[] = [];
  isLoading = true;
  error: string | null = null;

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
          this.orders = res.orders;
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Load orders error:', err);
        this.error = 'Σφάλμα φόρτωσης παραγγελιών';
        this.isLoading = false;
      },
    });
  }

  updateStatus(orderId: number, newStatus: string): void {
    if (newStatus === 'cancelled' && !confirm(`Είσαι σίγουρος ότι θέλεις να ακυρώσεις την παραγγελία #${orderId}; Αυτή η ενέργεια δεν αναιρείται.`)) {
      const order = this.orders.find(o => o.id === orderId);
      if (order) {
        const prev = order.status;
        order.status = '';
        setTimeout(() => order.status = prev, 0);
      }
      return;
    }
    this.adminService.updateOrderStatus(orderId, newStatus).subscribe({
      next: (res) => {
        if (res.success) {
          const order = this.orders.find((o) => o.id === orderId);
          if (order) order.status = newStatus;
          this.toastService.success('Κατάσταση παραγγελίας ενημερώθηκε!');
        }
      },
      error: (err) => {
        console.error('Update status error:', err);
        this.toastService.error(err?.error?.message || 'Αποτυχία ενημέρωσης κατάστασης');
      },
    });
  }

  // 🔵 CLICKABLE ROW NAVIGATION
  goToOrder(orderId: number): void {
    this.router.navigate(['/admin/orders', orderId]);
  }

  statusLabel(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'pending':
        return 'Σε αναμονή';
      case 'processing':
        return 'Σε επεξεργασία';
      case 'shipped':
        return 'Απεστάλη';
      case 'delivered':
        return 'Παραδόθηκε';
      case 'cancelled':
        return 'Ακυρώθηκε';
      default:
        return status;
    }
  }

}