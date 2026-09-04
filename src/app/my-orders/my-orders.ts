import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { OrderService } from '../order.service';
import { OrderTimelineComponent } from '../order-timeline/order-timeline';
import { SkeletonComponent } from '../skeleton/skeleton';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { statusLabel } from '../order-status.util';

type OrderRow = {
  id: number;
  total_amount: number;
  status: string;
  created_at: string;
  return_statuses?: ('pending' | 'approved' | 'rejected')[];
};


@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [CommonModule, RouterModule, OrderTimelineComponent, SkeletonComponent, PaginationComponent],
  templateUrl: './my-orders.html',
  styleUrl: './my-orders.css',
})
export class MyOrdersComponent implements OnInit {
  orders: OrderRow[] = [];
  isLoading = true;
  error: string | null = null;
  currentPage = 1;
  readonly pageSize = 20;
  private destroyRef = inject(DestroyRef);

  get pagedOrders(): OrderRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.orders.slice(start, start + this.pageSize);
  }

  constructor(
    private orderService: OrderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.isLoading = true;
    this.error = null;

    this.orderService.getMyOrders().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.orders = res.orders ?? [];
        this.currentPage = 1;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Αποτυχία φόρτωσης παραγγελιών.';
        this.isLoading = false;
      },
    });
  }

  goToOrder(orderId: number): void {
    this.router.navigate(['/profile/orders', orderId]);
  }

  statusLabel = statusLabel;


  normalizeStatus(status: string): 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' {
    const x = (status || '').toLowerCase();

    if (x === 'pending' || x === 'paid') return 'pending';
    if (x === 'processing') return 'processing';
    if (x === 'shipped') return 'shipped';
    if (x === 'delivered' || x === 'completed') return 'delivered';
    if (x === 'cancelled') return 'cancelled';

    return 'pending';
  }
}