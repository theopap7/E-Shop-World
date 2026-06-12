import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../toast.service';
import { environment } from '../../environments/environment';

interface ReturnItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
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
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin-returns.html',
  styleUrl: './admin-returns.css'
})
export class AdminReturnsComponent implements OnInit {
  returns: ReturnRequest[] = [];
  isLoading = false;
  processingId: number | null = null;
  adminNotes: Record<number, string> = {};

  private readonly apiUrl = `${environment.apiUrl}/admin/returns`;

  private destroyRef = inject(DestroyRef);

  constructor(private http: HttpClient, private toastService: ToastService) {}

  ngOnInit(): void {
    this.loadReturns();
  }

  loadReturns(): void {
    this.isLoading = true;
    this.http.get<{ success: boolean; returns: ReturnRequest[] }>(this.apiUrl).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.returns = res.returns || [];
        this.isLoading = false;
      },
      error: () => {
        this.toastService.error('Σφάλμα φόρτωσης αιτημάτων');
        this.isLoading = false;
      }
    });
  }

  updateStatus(r: ReturnRequest, status: 'approved' | 'rejected'): void {
    const label = status === 'approved' ? 'έγκριση' : 'απόρριψη';
    if (!confirm(`Επιβεβαίωση ${label} αιτήματος #${r.id};`)) return;

    this.processingId = r.id;
    this.http.patch<{ success: boolean; message: string }>(`${this.apiUrl}/${r.id}`, {
      status,
      adminNote: this.adminNotes[r.id] || ''
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.toastService.success(res.message);
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
    if (s === 'pending') return 'Σε Αναμονή';
    if (s === 'approved') return 'Εγκρίθηκε';
    if (s === 'rejected') return 'Απορρίφθηκε';
    return s;
  }

  get pendingCount(): number {
    return this.returns.filter(r => r.status === 'pending').length;
  }
}
