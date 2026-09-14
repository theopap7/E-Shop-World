import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EligibleProduct, Review, ReviewService } from '../services/review.service';
import { ToastService } from '../services/toast.service';
import { SkeletonComponent } from '../skeleton/skeleton';
import { ImageUrlPipe } from '../shared/image-url.pipe';

@Component({
  selector: 'app-my-reviews',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SkeletonComponent, ImageUrlPipe],
  templateUrl: './my-reviews.html',
  styleUrl: './my-reviews.css'
})
export class MyReviewsComponent implements OnInit {
  reviews: Review[] = [];
  eligibleProducts: EligibleProduct[] = [];
  isLoading = false;
  error = '';

  editingReviewId: number | null = null;
  editRating = 0;
  editComment = '';
  isUpdating = false;
  updateError = '';
  deletingId: number | null = null;

  private destroyRef = inject(DestroyRef);

  constructor(
    private reviewService: ReviewService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadMyReviews();
    this.loadEligibleProducts();
  }

  loadEligibleProducts(): void {
    this.reviewService.getEligibleProducts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.eligibleProducts = res.products;
      },
      error: () => {
        this.eligibleProducts = [];
      }
    });
  }

  loadMyReviews(): void {
    this.isLoading = true;
    this.error = '';

    this.reviewService.getMyReviews().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.reviews = res.reviews;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Σφάλμα φόρτωσης κριτικών';
        this.isLoading = false;
      }
    });
  }

  deleteReview(reviewId: number): void {
    if (this.deletingId === reviewId) return;
    if (!confirm('Διαγραφή κριτικής;')) return;

    this.deletingId = reviewId;
    this.reviewService.deleteReview(reviewId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.deletingId = null;
        this.toastService.success('Η κριτική διαγράφηκε');
        this.reviews = this.reviews.filter(r => r.id !== reviewId);
        this.loadEligibleProducts();

        if (this.editingReviewId === reviewId) {
          this.cancelEdit();
        }
      },
      error: (err) => {
        this.deletingId = null;
        this.toastService.error(err.error?.message || 'Σφάλμα διαγραφής');
      }
    });
  }

  startEdit(review: Review): void {
    this.editingReviewId = review.id;
    this.editRating = review.rating;
    this.editComment = review.comment || '';
    this.updateError = '';
  }

  cancelEdit(): void {
    this.editingReviewId = null;
    this.editRating = 0;
    this.editComment = '';
    this.updateError = '';
    this.isUpdating = false;
  }

  updateReview(reviewId: number): void {
    if (this.editRating < 1 || this.editRating > 5) {
      this.updateError = 'Το rating πρέπει να είναι από 1 έως 5.';
      return;
    }

    this.isUpdating = true;
    this.updateError = '';

    this.reviewService.updateReview(
      reviewId,
      this.editRating,
      this.editComment
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toastService.success('Η κριτική ενημερώθηκε επιτυχώς!');

        this.reviews = this.reviews.map(review =>
          review.id === reviewId
            ? {
                ...review,
                rating: this.editRating,
                comment: this.editComment?.trim() ? this.editComment.trim() : null
              }
            : review
        );

        this.cancelEdit();
      },
      error: (err) => {
        this.updateError = err.error?.message || 'Σφάλμα ενημέρωσης κριτικής';
        this.toastService.error(this.updateError);
        this.isUpdating = false;
      }
    });
  }

  getReviewStars(rating: number): string {
    return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  setEditRating(rating: number): void {
    this.editRating = rating;
  }
}