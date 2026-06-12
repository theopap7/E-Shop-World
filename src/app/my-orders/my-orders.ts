import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { OrderService, OrderDetailResponse } from '../order.service';
import { OrderTimelineComponent } from '../order-timeline/order-timeline';
import { SkeletonComponent } from '../skeleton/skeleton';
import { CartService } from '../cart.service';
import { statusLabel } from '../order-status.util';

type OrderRow = {
  id: number;
  total_amount: number;
  status: string;
  created_at: string;
  return_status?: string | null;
};


@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [CommonModule, RouterModule, OrderTimelineComponent, SkeletonComponent],  
  templateUrl: './my-orders.html',
  styleUrl: './my-orders.css',
})
export class MyOrdersComponent implements OnInit {
  orders: OrderRow[] = [];
  isLoading = true;
  error: string | null = null;
  reorderingId: number | null = null;

  private destroyRef = inject(DestroyRef);

  constructor(
    private orderService: OrderService,
    private cartService: CartService,
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

  reorderAll(orderId: number, event: Event): void {
    event.stopPropagation();
    if (this.reorderingId === orderId) return;
    this.reorderingId = orderId;
    this.orderService.getOrderDetails(orderId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: OrderDetailResponse) => {
        const items = res.items ?? [];
        this.reorderingId = null;
        this.cartService.reorderItems(items.map(i => ({
          id: i.product_id,
          name: i.product_name,
          price: i.unit_price,
          stock: i.stock ?? 999,
          image_url: i.image_url
        })));
      },
      error: () => { this.reorderingId = null; }
    });
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