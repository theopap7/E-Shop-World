import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OrderService, MyReturnRow } from '../order.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { ImageUrlPipe } from '../shared/image-url.pipe';

interface OrderReturnGroup {
  orderId: number;
  requests: MyReturnRow[];
  latestCreatedAt: string;
}

@Component({
  selector: 'app-my-returns',
  standalone: true,
  imports: [CommonModule, RouterModule, PaginationComponent, ImageUrlPipe],
  templateUrl: './my-returns.html',
  styleUrl: './my-returns.css',
})
export class MyReturnsComponent implements OnInit {
  groups: OrderReturnGroup[] = [];
  isLoading = true;
  error: string | null = null;
  currentPage = 1;
  readonly pageSize = 20;

  private destroyRef = inject(DestroyRef);

  constructor(private orderService: OrderService) {}

  get pagedGroups(): OrderReturnGroup[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.groups.slice(start, start + this.pageSize);
  }

  ngOnInit(): void {
    this.isLoading = true;
    this.orderService.getMyReturns().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.groups = this.buildGroups(res.returns || []);
        this.currentPage = 1;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Αποτυχία φόρτωσης αιτημάτων επιστροφής.';
        this.isLoading = false;
      }
    });
  }

  private buildGroups(returns: MyReturnRow[]): OrderReturnGroup[] {
    const byOrder = new Map<number, MyReturnRow[]>();
    for (const r of returns) {
      if (!byOrder.has(r.order_id)) byOrder.set(r.order_id, []);
      byOrder.get(r.order_id)!.push(r);
    }

    const groups: OrderReturnGroup[] = [];
    for (const [orderId, requests] of byOrder) {
      requests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      groups.push({ orderId, requests, latestCreatedAt: requests[0].created_at });
    }

    groups.sort((a, b) => new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime());
    return groups;
  }

  statusLabel(status: string): string {
    if (status === 'pending') return 'Σε Αναμονή';
    if (status === 'approved') return 'Εγκρίθηκε';
    if (status === 'rejected') return 'Απορρίφθηκε';
    return status;
  }
}
