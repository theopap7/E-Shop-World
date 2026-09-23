import { Component, OnInit, DestroyRef, HostListener, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService, AdminCategory } from '../services/admin.service';
import { ToastService } from '../services/toast.service';
import { ConfirmService } from '../services/confirm.service';

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-categories.html',
  styleUrl: './admin-categories.css'
})
export class AdminCategoriesComponent implements OnInit {
  categories: AdminCategory[] = [];
  isLoading = false;

  showModal = false;
  error = false;
  isEditMode = false;
  editingCategoryId: number | null = null;
  isSaving = false;

  form = {
    name: ''
  };

  private destroyRef = inject(DestroyRef);

  constructor(
    private adminService: AdminService,
    private toastService: ToastService,
    private confirmService: ConfirmService
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.isLoading = true;
    this.error = false;

    this.adminService.getCategories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.categories = res.categories || [];
        this.isLoading = false;
      },
      error: () => {
        this.error = true;
        this.isLoading = false;
      }
    });
  }

  openCreateModal(): void {
    this.isEditMode = false;
    this.editingCategoryId = null;
    this.resetForm();
    this.showModal = true;
  }

  openEditModal(category: AdminCategory): void {
    this.isEditMode = true;
    this.editingCategoryId = category.id;
    this.form = {
      name: category.name
    };
    this.showModal = true;
  }

  resetForm(): void {
    this.form = { name: '' };
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (!this.showModal || this.isSaving || event.defaultPrevented || this.confirmService.isOpen) return;
    event.preventDefault();
    this.closeModal();
  }

  closeModal(): void {
    this.showModal = false;
    this.isEditMode = false;
    this.editingCategoryId = null;
    this.resetForm();
  }

  saveCategory(): void {
    if (!this.form.name.trim()) {
      this.toastService.warning('Συμπλήρωσε το όνομα κατηγορίας');
      return;
    }
    if (this.isSaving) return;
    this.isSaving = true;

    const payload = {
      name: this.form.name.trim()
    };

    const request = this.isEditMode && this.editingCategoryId
      ? this.adminService.updateCategory(this.editingCategoryId, payload)
      : this.adminService.createCategory(payload);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.isSaving = false;
        if (res.success) {
          this.toastService.success(this.isEditMode ? 'Κατηγορία ενημερώθηκε!' : 'Κατηγορία δημιουργήθηκε!');
          this.closeModal();
          this.loadCategories();
        }
      },
      error: (err) => {
        this.isSaving = false;
        this.toastService.error(err.error?.message || 'Σφάλμα αποθήκευσης');
      }
    });
  }

  async deleteCategory(id: number, name: string): Promise<void> {
    const ok = await this.confirmService.confirm(`Είσαι σίγουρος ότι θέλεις να διαγράψεις την κατηγορία "${name}";`, { danger: true, confirmText: 'Διαγραφή' });
    if (!ok) return;

    this.adminService.deleteCategory(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success) {
          this.toastService.success(res.message || 'Κατηγορία διαγράφηκε');
          this.loadCategories();
        }
      },
      error: (err) => {
        this.toastService.error(err.error?.message || 'Σφάλμα διαγραφής');
      }
    });
  }
}
