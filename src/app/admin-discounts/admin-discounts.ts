import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../toast.service';
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

  constructor(
    private http: HttpClient,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadCodes();
  }

  loadCodes(): void {
    this.isLoading = true;

    this.http.get<any>(this.apiUrl).subscribe({
      next: (res) => {
        this.codes = res.codes || [];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Load codes error:', err);
        this.toastService.error('Σφάλμα φόρτωσης κωδικών');
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

  closeModal(): void {
    this.showModal = false;
    this.isEditMode = false;
    this.editingCodeId = null;
    this.resetForm();
  }

  saveCode(): void {
    if (!this.form.code || this.form.value == null) {
      this.toastService.warning('Συμπλήρωσε όλα τα υποχρεωτικά πεδία');
      return;
    }
    if (this.isSaving) return;
    this.isSaving = true;

    const payload = {
      code: this.form.code.toUpperCase(),
      type: this.form.type,
      value: this.form.value,
      minOrderAmount: this.form.minOrderAmount || 0,
      maxUses: this.form.maxUses || null,
      expiresAt: this.form.expiresAt || null,
      active: this.form.active
    };

    if (this.isEditMode && this.editingCodeId) {
      this.http.put<any>(
        `${this.apiUrl}/${this.editingCodeId}`,
        payload
      ).subscribe({
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

    this.http.post<any>(this.apiUrl, payload).subscribe({
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
    this.http.put<any>(`${this.apiUrl}/${code.id}`, {
      code: code.code,
      type: code.type,
      value: code.value,
      minOrderAmount: code.min_order_amount,
      maxUses: code.max_uses,
      expiresAt: code.expires_at,
      active: !code.active
    }).subscribe({
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

  deleteCode(id: number, code: string): void {
    if (!confirm(`Είσαι σίγουρος ότι θέλεις να διαγράψεις τον κωδικό "${code}";`)) return;

    this.http.delete<any>(`${this.apiUrl}/${id}`).subscribe({
      next: (res) => {
        if (res.success) {
          this.toastService.success('Κωδικός διαγράφηκε');
          this.loadCodes();
        }
      },
      error: () => {
        this.toastService.error('Σφάλμα διαγραφής');
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
      ? `${code.value}%`
      : `${code.value}€`;
  }

  isExpired(expiresAt: string | null): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
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