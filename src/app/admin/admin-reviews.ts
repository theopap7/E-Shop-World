import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { AdminService, AdminReviewDto } from '../admin.service';
import { RouterModule } from '@angular/router';
import { ToastService } from '../toast.service';
import { PaginationComponent } from '../shared/pagination/pagination.component';
import { ImageUrlPipe } from '../shared/image-url.pipe';

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [CommonModule, RouterModule, PaginationComponent, ImageUrlPipe],
  templateUrl: './admin-reviews.html',
  styleUrl: './admin-reviews.css'
})
export class AdminReviewsComponent implements OnInit {

  reviews: AdminReviewDto[] = [];
  isLoading = false;
  error = '';
  currentPage = 1;
  readonly pageSize = 15;

  private destroyRef = inject(DestroyRef);

  constructor(private adminService: AdminService, private toastService: ToastService) {}

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
      error: (err) => {
        this.error = 'Σφάλμα φόρτωσης reviews.';
        this.isLoading = false;
      }
    });
  }

  deleteReview(reviewId: number, productName: string): void {
    if (!confirm(`Διαγραφή review για "${productName}";`)) {
      return;
    }

    this.adminService.deleteReview(reviewId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success) {
          // Remove από τη λίστα
          this.reviews = this.reviews.filter(r => r.id !== reviewId);
          this.toastService.success('Review διαγράφηκε επιτυχώς!');
        }
      },
      error: (err) => {
        this.toastService.error(err.error?.message || 'Σφάλμα διαγραφής review.');
      }
    });
  }

  get pagedReviews(): AdminReviewDto[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.reviews.slice(start, start + this.pageSize);
  }

  getStars(rating: number): string {
    return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  }
}