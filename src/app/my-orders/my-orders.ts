import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OrderService } from '../order.service';
import { OrderTimelineComponent } from '../order-timeline/order-timeline';
import { SkeletonComponent } from '../skeleton/skeleton';
import { CartService } from '../cart.service';

type OrderRow = {
  id: number;
  total_amount: number;
  status: string;
  created_at: string;
  return_status?: string | null;
};

type OrderItem = {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  stock: number;
  image_url?: string;
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
  expandedOrderId: number | null = null;
  itemsMap: Record<number, OrderItem[]> = {};
  loadingItems: Record<number, boolean> = {};

  reorderingId: number | null = null;

  constructor(private orderService: OrderService, private cartService: CartService) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.isLoading = true;
    this.error = null;

    this.orderService.getMyOrders().subscribe({
      next: (res: any) => {
        this.orders = (res?.orders ?? []) as OrderRow[];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('getMyOrders error:', err);
        this.error = err?.error?.message || 'Αποτυχία φόρτωσης παραγγελιών.';
        this.isLoading = false;
      },
    });
  }

 
  toggleOrderDetails(orderId: number): void {
    if (this.expandedOrderId === orderId) {
      this.expandedOrderId = null;
      return;
    }
    this.expandedOrderId = orderId;
    if (!this.itemsMap[orderId]) {
      this.loadingItems[orderId] = true;
      this.orderService.getOrderDetails(orderId).subscribe({
        next: (res: any) => {
          this.itemsMap[orderId] = res.items ?? [];
          this.loadingItems[orderId] = false;
        },
        error: () => {
          this.itemsMap[orderId] = [];
          this.loadingItems[orderId] = false;
        }
      });
    }
  }

  
  reorderAll(orderId: number): void {
    if (this.reorderingId === orderId) return;
    const items = this.itemsMap[orderId];
    if (items) {
      this.cartService.reorderItems(items.map(i => ({
        id: i.product_id,
        name: i.product_name,
        price: i.unit_price,
        stock: i.stock,
        image_url: i.image_url
      })));
      return;
    }
    this.reorderingId = orderId;
    this.orderService.getOrderDetails(orderId).subscribe({
      next: (res: any) => {
        const loaded: OrderItem[] = res.items ?? [];
        this.itemsMap[orderId] = loaded;
        this.reorderingId = null;
        this.cartService.reorderItems(loaded.map(i => ({
          id: i.product_id,
          name: i.product_name,
          price: i.unit_price,
          stock: i.stock,
          image_url: i.image_url
        })));
      },
      error: () => { this.reorderingId = null; }
    });
  }

  statusLabel(s: string): string {
    const x = (s || '').toLowerCase();
    if (x === 'pending') return 'Σε Αναμονή';
    if (x === 'processing') return 'Σε Επεξεργασία';
    if (x === 'shipped') return 'Αποστολή';
    if (x === 'delivered') return 'Παραδόθηκε';
    if (x === 'cancelled') return 'Ακυρώθηκε';
    return s || '—';
  }


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