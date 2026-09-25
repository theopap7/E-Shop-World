import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminReviewDto } from '../services/admin.service';
import { RouterModule } from '@angular/router';
import { ToastService } from '../services/toast.service';
import { ConfirmService } from '../services/confirm.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { ImageUrlPipe } from '../shared/image-url.pipe';
import { RatingStarsComponent } from '../shared/rating-stars/rating-stars.component';

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PaginationComponent, ImageUrlPipe, RatingStarsComponent],
  templateUrl: './admin-reviews.html',
  styleUrl: './admin-reviews.css'
})
export class AdminReviewsComponent implements OnInit {

  reviews: AdminReviewDto[] = [];
  isLoading = false;
  error = '';
  searchTerm = '';
  ratingFilter = 'all';
  readonly ratingOptions = [5, 4, 3, 2, 1];
  currentPage = 1;
  readonly pageSize = 15;

  private destroyRef = inject(DestroyRef);

  constructor(private adminService: AdminService, private toastService: ToastService, private confirmService: ConfirmService) {}

  ngOnInit(): void {
    this.loadReviews();
  }

  loadReviews(): void {
    this.isLoading = true;
    this.error = '';

    this.adminService.getAllReviews().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success) {
          this.reviews = res.reviews;
        }
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Σφάλμα φόρτωσης κριτικών.';
        this.isLoading = false;
      }
    });
  }

  async deleteReview(reviewId: number, productName: string): Promise<void> {
    const ok = await this.confirmService.confirm(`Να διαγραφεί η κριτική για "${productName}";`, { danger: true, confirmText: 'Διαγραφή' });
    if (!ok) {
      return;
    }

    this.adminService.deleteReview(reviewId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success) {
          this.reviews = this.reviews.filter(r => r.id !== reviewId);
          const maxPage = Math.max(1, Math.ceil(this.filteredReviews.length / this.pageSize));
          if (this.currentPage > maxPage) this.currentPage = maxPage;
          this.toastService.success('Η κριτική διαγράφηκε επιτυχώς!');
        }
      },
      error: (err) => {
        this.toastService.error(err.error?.message || 'Σφάλμα διαγραφής κριτικής.');
      }
    });
  }

  get filteredReviews(): AdminReviewDto[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.reviews.filter(r =>
      (this.ratingFilter === 'all' || r.rating === Number(this.ratingFilter)) &&
      (!term ||
        r.product_name?.toLowerCase().includes(term) ||
        `${r.first_name} ${r.last_name}`.toLowerCase().includes(term) ||
        r.email?.toLowerCase().includes(term) ||
        r.comment?.toLowerCase().includes(term))
    );
  }

  get pagedReviews(): AdminReviewDto[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredReviews.slice(start, start + this.pageSize);
  }

  onFilterChange(): void {
    this.currentPage = 1;
  }

}