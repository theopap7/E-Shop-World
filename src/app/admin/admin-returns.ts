import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, formatCurrency } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../services/toast.service';
import { ConfirmService } from '../services/confirm.service';
import { AdminService } from '../services/admin.service';
import { ImageUrlPipe } from '../shared/image-url.pipe';
import { environment } from '../../environments/environment';
import { returnStatusLabel, returnItemSymbol } from '../services/return-status.util';
import { ReturnItem, ReturnRequestStatus } from '../services/order.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';

type Decision = 'approved' | 'rejected';

interface ReturnRequest {
  id: number;
  order_id: number;
  reason: string | null;
  status: ReturnRequestStatus;
  admin_note: string | null;
  refund_amount: number;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  total_amount: number;
  subtotal: number;
  discount_amount: number;
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
  decisions: Record<number, Decision> = {};
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
        this.decisions = {};
        this.currentPage = 1;
        this.isLoading = false;
      },
      error: () => {
        this.toastService.error('Σφάλμα φόρτωσης αιτημάτων');
        this.isLoading = false;
      }
    });
  }

  setDecision(item: ReturnItem, decision: Decision): void {
    this.decisions[item.id] = decision;
  }

  setAllDecisions(r: ReturnRequest, decision: Decision): void {
    for (const item of r.items) this.decisions[item.id] = decision;
  }

  allDecided(r: ReturnRequest): boolean {
    return r.items.length > 0 && r.items.every(item => this.decisions[item.id]);
  }

  approvedCount(r: ReturnRequest): number {
    return r.items.filter(item => this.decisions[item.id] === 'approved').length;
  }

  decidedRefund(r: ReturnRequest): number {
    const subtotal = Number(r.subtotal);
    const discountRatio = subtotal > 0 ? Number(r.discount_amount) / subtotal : 0;
    const approvedSubtotal = r.items
      .filter(item => this.decisions[item.id] === 'approved')
      .reduce((sum, item) => sum + item.quantity * Number(item.unit_price), 0);
    return Math.min(Number((approvedSubtotal * (1 - discountRatio)).toFixed(2)), Number(r.total_amount));
  }

  async submitDecisions(r: ReturnRequest): Promise<void> {
    if (!this.allDecided(r)) {
      this.toastService.warning('Διάλεξε έγκριση ή απόρριψη για κάθε προϊόν');
      return;
    }

    const approved = this.approvedCount(r);
    const rejected = r.items.length - approved;
    const refund = formatCurrency(this.decidedRefund(r), 'el', '€', 'EUR');
    const message = rejected === 0
      ? `Εγκρίνεις όλα τα προϊόντα (${approved}). Θα επιστραφούν ${refund}.`
      : approved === 0
        ? `Απορρίπτεις όλα τα προϊόντα (${rejected}). Δεν θα γίνει επιστροφή χρημάτων.`
        : `Εγκρίνεις ${approved} και απορρίπτεις ${rejected} από τα ${r.items.length} προϊόντα. Θα επιστραφούν ${refund}.`;
    const ok = await this.confirmService.confirm(message, {
      title: `Αίτημα επιστροφής #${r.id}`,
      danger: approved === 0,
      confirmText: approved === 0 ? 'Απόρριψη' : 'Ολοκλήρωση'
    });
    if (!ok) return;

    this.processingId = r.id;
    this.http.patch<{ success: boolean; message: string }>(`${this.apiUrl}/${r.id}`, {
      items: r.items.map(item => ({ id: item.id, status: this.decisions[item.id] })),
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

  itemSymbol = returnItemSymbol;

  get pendingCount(): number {
    return this.returns.filter(r => r.status === 'pending').length;
  }
}
