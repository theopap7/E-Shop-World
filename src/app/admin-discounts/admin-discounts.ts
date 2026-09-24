import { Component, OnInit, DestroyRef, HostListener, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, formatCurrency, formatNumber } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../services/toast.service';
import { ConfirmService } from '../services/confirm.service';
import { RouterModule } from '@angular/router';
import { environment } from '../../environments/environment';

interface DiscountCode {
  id: number;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_order_amount: number;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
}

@Component({
  selector: 'app-admin-discounts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-discounts.html',
  styleUrl: './admin-discounts.css'
})
export class AdminDiscountsComponent implements OnInit {
  codes: DiscountCode[] = [];
  isLoading = false;
  error = false;

  showModal = false;
  isEditMode = false;
  editingCodeId: number | null = null;
  isSaving = false;

  form = {
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: 10,
    minOrderAmount: 0,
    maxUses: null as number | null,
    expiresAt: '',
    active: true
  };

  private readonly apiUrl = `${environment.apiUrl}/admin/discount-codes`;

  private destroyRef = inject(DestroyRef);

  constructor(
    private http: HttpClient,
    private toastService: ToastService,
    private confirmService: ConfirmService
  ) {}

  ngOnInit(): void {
    this.loadCodes();
  }

  loadCodes(): void {
    this.isLoading = true;
    this.error = false;

    this.http.get<{ codes: DiscountCode[] }>(this.apiUrl).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.codes = (res.codes || []).map(code => ({
          ...code,
          value: Number(code.value),
          min_order_amount: Number(code.min_order_amount)
        }));
        this.isLoading = false;
      },
      error: () => {
        this.toastService.error('Σφάλμα φόρτωσης κωδικών');
        this.error = true;
        this.isLoading = false;
      }
    });
  }

  openCreateModal(): void {
    this.isEditMode = false;
    this.editingCodeId = null;
    this.resetForm();
    this.showModal = true;
  }

  openEditModal(code: DiscountCode): void {
    this.isEditMode = true;
    this.editingCodeId = code.id;

    this.form = {
      code: code.code,
      type: code.type,
      value: Number(code.value),
      minOrderAmount: Number(code.min_order_amount || 0),
      maxUses: code.max_uses,
      expiresAt: this.formatDateForInput(code.expires_at),
      active: !!code.active
    };

    this.showModal = true;
  }

  resetForm(): void {
    this.form = {
      code: '',
      type: 'percentage',
      value: 10,
      minOrderAmount: 0,
      maxUses: null,
      expiresAt: '',
      active: true
    };
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (!this.showModal || event.defaultPrevented || this.confirmService.isOpen) return;
    event.preventDefault();
    this.closeModal();
  }

  closeModal(): void {
    this.showModal = false;
    this.isEditMode = false;
    this.editingCodeId = null;
    this.resetForm();
  }

  saveCode(): void {
    if (!this.form.code?.trim() || this.form.value == null) {
      this.toastService.warning('Συμπλήρωσε όλα τα υποχρεωτικά πεδία');
      return;
    }
    if (this.form.value <= 0) {
      this.toastService.warning('Η αξία πρέπει να είναι μεγαλύτερη από 0');
      return;
    }
    if (this.form.type === 'percentage' && this.form.value > 100) {
      this.toastService.warning('Το ποσοστό πρέπει να είναι 0-100');
      return;
    }
    if (this.form.maxUses != null && this.form.maxUses < 1) {
      this.toastService.warning('Οι μέγιστες χρήσεις πρέπει να είναι τουλάχιστον 1 (άφησε κενό για απεριόριστες)');
      return;
    }
    if (this.isSaving) return;
    this.isSaving = true;

    const payload = {
      code: this.form.code.trim().toUpperCase(),
      type: this.form.type,
      value: this.form.value,
      minOrderAmount: this.form.minOrderAmount || 0,
      maxUses: this.form.maxUses ?? null,
      expiresAt: this.form.expiresAt || null,
      active: this.form.active
    };

    if (this.isEditMode && this.editingCodeId) {
      this.http.put<{ success: boolean; message?: string }>(
        `${this.apiUrl}/${this.editingCodeId}`,
        payload
      ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res) => {
          this.isSaving = false;
          if (res.success) {
            this.toastService.success('Ο κωδικός ενημερώθηκε ✏️');
            this.closeModal();
            this.loadCodes();
          }
        },
        error: (err) => {
          this.isSaving = false;
          this.toastService.error(err.error?.message || 'Σφάλμα ενημέρωσης');
        }
      });
      return;
    }

    this.http.post<{ success: boolean; message?: string }>(this.apiUrl, payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.isSaving = false;
        if (res.success) {
          this.toastService.success('Κωδικός δημιουργήθηκε! 🎟️');
          this.closeModal();
          this.loadCodes();
        }
      },
      error: (err) => {
        this.isSaving = false;
        this.toastService.error(err.error?.message || 'Σφάλμα δημιουργίας');
      }
    });
  }

  toggleActive(code: DiscountCode): void {
    this.http.put<{ success: boolean; message?: string }>(`${this.apiUrl}/${code.id}`, {
      code: code.code,
      type: code.type,
      value: code.value,
      minOrderAmount: code.min_order_amount,
      maxUses: code.max_uses,
      expiresAt: this.formatDateForInput(code.expires_at) || null,
      active: !code.active
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success) {
          code.active = !code.active;
          this.toastService.success(code.active ? 'Ενεργοποιήθηκε' : 'Απενεργοποιήθηκε');
        }
      },
      error: () => {
        this.toastService.error('Σφάλμα ενημέρωσης');
      }
    });
  }

  async deleteCode(id: number, code: string): Promise<void> {
    const ok = await this.confirmService.confirm(`Είσαι σίγουρος ότι θέλεις να διαγράψεις τον κωδικό "${code}";`, { danger: true, confirmText: 'Διαγραφή' });
    if (!ok) return;

    this.http.delete<{ success: boolean; message?: string }>(`${this.apiUrl}/${id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success) {
          this.toastService.success('Κωδικός διαγράφηκε');
          this.loadCodes();
        }
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'Σφάλμα διαγραφής');
      }
    });
  }

  formatDateForInput(date: string | null): string {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getTypeLabel(type: string): string {
    return type === 'percentage' ? 'Ποσοστό' : 'Σταθερό';
  }

  getValueDisplay(code: DiscountCode): string {
    return code.type === 'percentage'
      ? `${formatNumber(Number(code.value), 'el', '1.0-2')}%`
      : formatCurrency(Number(code.value), 'el', '€', 'EUR');
  }

  isExpired(expiresAt: string | null): boolean {
    if (!expiresAt) return false;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return expiresAt.slice(0, 10) < todayStr;
  }

  isExhausted(code: DiscountCode): boolean {
    if (!code.max_uses) return false;
    return code.used_count >= code.max_uses;
  }

  getDiscountStatus(code: DiscountCode): 'expired' | 'exhausted' | 'inactive' | 'active' {
    if (this.isExpired(code.expires_at)) return 'expired';
    if (this.isExhausted(code)) return 'exhausted';
    if (!code.active) return 'inactive';
    return 'active';
  }
}