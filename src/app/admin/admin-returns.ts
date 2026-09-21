import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../services/toast.service';
import { ConfirmService } from '../services/confirm.service';
import { AdminService } from '../services/admin.service';
import { ImageUrlPipe } from '../shared/image-url.pipe';
import { environment } from '../../environments/environment';
import { returnStatusLabel } from '../services/return-status.util';
import { PaginationComponent } from '../shared/pagination/pagination.component';

interface ReturnItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  size?: string | null;
  image_url?: string | null;
}

interface ReturnRequest {
  id: number;
  order_id: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  refund_amount: number;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  total_amount: number;
  order_status: string;
  items: ReturnItem[];
}

@Component({
  selector: 'app-admin-returns',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ImageUrlPipe, PaginationComponent],
  templateUrl: './admin-returns.html',
  styleUrl: './admin-returns.css'
})
export class AdminReturnsComponent implements OnInit {
  returns: ReturnRequest[] = [];
  isLoading = false;
  processingId: number | null = null;
  adminNotes: Record<number, string> = {};
  currentPage = 1;
  readonly pageSize = 15;

  get pagedReturns(): ReturnRequest[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.returns.slice(start, start + this.pageSize);
  }

  private readonly apiUrl = `${environment.apiUrl}/admin/returns`;

  private destroyRef = inject(DestroyRef);

  constructor(private http: HttpClient, private toastService: ToastService, private adminService: AdminService, private confirmService: ConfirmService) {}

  ngOnInit(): void {
    this.loadReturns();
  }

  loadReturns(): void {
    this.isLoading = true;
    this.http.get<{ success: boolean; returns: ReturnRequest[] }>(this.apiUrl).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.returns = res.returns || [];
        this.currentPage = 1;
        this.isLoading = false;
      },
      error: () => {
        this.toastService.error('Σφάλμα φόρτωσης αιτημάτων');
        this.isLoading = false;
      }
    });
  }

  async updateStatus(r: ReturnRequest, status: 'approved' | 'rejected'): Promise<void> {
    const approving = status === 'approved';
    const ok = await this.confirmService.confirm(
      approving
        ? `Να εγκριθεί το αίτημα επιστροφής #${r.id};`
        : `Να απορριφθεί το αίτημα επιστροφής #${r.id};`,
      { danger: !approving, confirmText: approving ? 'Έγκριση' : 'Απόρριψη' }
    );
    if (!ok) return;

    this.processingId = r.id;
    this.http.patch<{ success: boolean; message: string }>(`${this.apiUrl}/${r.id}`, {
      status,
      adminNote: this.adminNotes[r.id] || ''
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.toastService.success(res.message);
        this.adminService.invalidateStatsCache();
        this.loadReturns();
        this.processingId = null;
      },
      error: (err) => {
        this.toastService.error(err.error?.message || 'Σφάλμα ενημέρωσης');
        this.processingId = null;
      }
    });
  }

  statusLabel(s: string): string {
    return returnStatusLabel(s);
  }

  get pendingCount(): number {
    return this.returns.filter(r => r.status === 'pending').length;
  }
}
