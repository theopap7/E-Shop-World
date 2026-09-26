import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { AdminService, AdminOrder } from '../services/admin.service';
import { ToastService } from '../services/toast.service';
import { ConfirmService } from '../services/confirm.service';
import { statusLabel } from '../services/order-status.util';
import { paymentStatusLabel } from '../services/order-labels.util';
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
    { key: 'all', label: 'Όλες' },
    { key: 'awaiting_payment', label: '💳 Προς επιβεβαίωση' },
    ...(['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const).map(key => ({
      key,
      label: statusLabel(key),
    })),
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

  needsPaymentConfirmation(order: AdminOrder): boolean {
    return order.payment_method === 'bank_transfer' && order.payment_status === 'pending' && order.status !== 'cancelled';
  }

  needsAttention(order: AdminOrder): boolean {
    return order.status === 'pending' || this.needsPaymentConfirmation(order);
  }

  private matchesFilter(order: AdminOrder, key: string): boolean {
    if (key === 'all') return true;
    if (key === 'awaiting_payment') return this.needsPaymentConfirmation(order);
    return order.status === key;
  }

  get filteredOrders(): AdminOrder[] {
    return this.searchFilteredOrders.filter(o => this.matchesFilter(o, this.activeFilter));
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
    return this.searchFilteredOrders.filter(o => this.matchesFilter(o, key)).length;
  }

  private destroyRef = inject(DestroyRef);

  constructor(
    private adminService: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService,
    private confirmService: ConfirmService
  ) {}

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('filter') === 'awaiting_payment') {
      this.activeFilter = 'awaiting_payment';
    }
    this.loadOrders();
  }

  loadOrders(): void {
    this.isLoading = true;
    this.error = null;

    this.adminService.getOrders().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success) {
          this.orders = this.sortOrders(res.orders);
        }
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Σφάλμα φόρτωσης παραγγελιών';
        this.isLoading = false;
      },
    });
  }

  // Re-fetches without toggling isLoading, so a single status change doesn't
  // flash the whole table into its loading skeleton.
  private refreshOrdersQuietly(): void {
    this.adminService.getOrders().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success) {
          this.orders = this.sortOrders(res.orders);
        }
      }
    });
  }

  private sortOrders(orders: AdminOrder[]): AdminOrder[] {
    return orders.sort((a: AdminOrder, b: AdminOrder) =>
      Number(this.needsAttention(b)) - Number(this.needsAttention(a))
    );
  }

  // Forces the <select>'s bound value to re-render as the real status — the
  // native element already jumped to the user's clicked option before we knew
  // whether the change would be accepted, so a rejected/cancelled change needs
  // this to snap the dropdown back instead of leaving it on the stale pick.
  private resyncSelect(orderId: number): void {
    const order = this.orders.find(o => o.id === orderId);
    if (order) {
      const prev = order.status;
      order.status = '';
      setTimeout(() => order.status = prev, 0);
    }
  }

  async updateStatus(orderId: number, newStatus: string): Promise<void> {
    if (this.updatingId === orderId) return;

    if (newStatus === 'cancelled') {
      const ok = await this.confirmService.confirm(`Σίγουρα θέλεις να ακυρώσεις την παραγγελία #${orderId}; Αυτή η ενέργεια δεν αναιρείται.`, { danger: true, title: 'Ακύρωση παραγγελίας', confirmText: 'Ακύρωση παραγγελίας', cancelText: 'Πίσω' });
      if (!ok) {
        this.resyncSelect(orderId);
        return;
      }
    }

    this.updatingId = orderId;
    this.adminService.updateOrderStatus(orderId, newStatus).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success) {
          // Reload instead of patching order.status locally — the server may also
          // change payment_status as a side effect (e.g. COD auto-marks paid on
          // delivery), and a local patch would leave that stale until next refresh.
          this.refreshOrdersQuietly();
          this.adminService.invalidateStatsCache();
          this.toastService.success('Κατάσταση παραγγελίας ενημερώθηκε!');
        }
        this.updatingId = null;
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'Αποτυχία ενημέρωσης κατάστασης');
        this.resyncSelect(orderId);
        this.updatingId = null;
      },
    });
  }

  goToOrder(orderId: number): void {
    this.router.navigate(['/admin/orders', orderId]);
  }

  confirmingPaymentId: number | null = null;

  confirmPayment(orderId: number, event: Event): void {
    event.stopPropagation();
    if (this.confirmingPaymentId === orderId) return;

    this.confirmingPaymentId = orderId;
    this.adminService.confirmPayment(orderId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success) {
          const order = this.orders.find((o) => o.id === orderId);
          if (order) order.payment_status = 'paid';
          this.adminService.invalidateStatsCache();
          this.toastService.success('Η πληρωμή επιβεβαιώθηκε!');
        }
        this.confirmingPaymentId = null;
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'Αποτυχία επιβεβαίωσης πληρωμής');
        this.confirmingPaymentId = null;
      },
    });
  }

  statusLabel = statusLabel;
  paymentStatusLabel = paymentStatusLabel;

}