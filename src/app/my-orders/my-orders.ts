import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OrderService } from '../order.service';
import { OrderTimelineComponent } from '../order-timeline/order-timeline';  
import { SkeletonComponent } from '../skeleton/skeleton';

type OrderRow = {
  id: number;
  total_amount: number;
  status: string;
  created_at: string;
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
  expandedOrderId: number | null = null;  // ✅ NEW: Track which order is expanded

  constructor(private orderService: OrderService) {}

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
    this.expandedOrderId = this.expandedOrderId === orderId ? null : orderId;
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