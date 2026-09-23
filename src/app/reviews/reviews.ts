import { Component, Input, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RatingStarsComponent } from '../shared/rating-stars/rating-stars.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ReviewService, Review } from '../services/review.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { ConfirmService } from '../services/confirm.service';
import { starFill } from '../shared/star-fill';

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, RatingStarsComponent],
  templateUrl: './reviews.html',
  styleUrl: './reviews.css'
})
export class ReviewsComponent implements OnInit {

  @Input() productId!: number;

  reviews: Review[] = [];
  average = 0;
  total = 0;
  isLoading = false;
  error = '';

  // Form state (για νέο review)
  newRating = 0;
  hoveredRating = 0;
  newComment = '';
  isSubmitting = false;
  submitError = '';

  // Edit state
  editingReviewId: number | null = null;
  editRating = 0;
  editComment = '';
  editHoveredRating = 0;
  isUpdating = false;
  updateError = '';

  isLoggedIn = false;
  currentUserId: number | null = null;
  canReview = false;

  get hasExistingReview(): boolean {
    if (!this.currentUserId) return false;
    return this.reviews.some(r => r.user_id === this.currentUserId);
  }

  get reviewsLabel(): string {
    return this.total === 1 ? 'κριτική' : 'κριτικές';
  }

  private destroyRef = inject(DestroyRef);

  constructor(
    private reviewService: ReviewService,
    private authService: AuthService,
    private toastService: ToastService,
    private confirmService: ConfirmService
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    const user = this.authService.getUser();
    this.currentUserId = user?.id || null;
    this.loadReviews();
    this.loadEligibility();
  }

  loadEligibility(): void {
    if (!this.isLoggedIn) return;

    this.reviewService.getEligibleProducts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.canReview = res.products.some(p => p.product_id === this.productId);
      },
      error: () => {
        this.canReview = false;
      }
    });
  }

  loadReviews(): void {
    this.isLoading = true;

    this.reviewService.getReviews(this.productId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.reviews = res.reviews;
        this.average = res.average;
        this.total = res.total;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  setRating(rating: number): void {
    this.newRating = rating;
  }

  setHovered(rating: number): void {
    this.hoveredRating = rating;
  }

  clearHovered(): void {
    this.hoveredRating = 0;
  }

  summaryStarClass(star: number): string {
    const fill = starFill(star, this.average);
    return fill === 'full' ? 'star filled' : fill === 'half' ? 'star half' : 'star';
  }

  getStarClass(star: number): string {
    const activeRating = this.hoveredRating || this.newRating;
    return star <= activeRating ? 'star filled' : 'star';
  }


  submitReview(): void {
    if (this.newRating === 0) {
      this.submitError = 'Παρακαλώ επίλεξε rating!';
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';

    this.reviewService.submitReview(
      this.productId,
      this.newRating,
      this.newComment
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success) {
          this.toastService.success('Η κριτική σου υποβλήθηκε επιτυχώς! ⭐');
          this.newRating = 0;
          this.newComment = '';
          this.loadReviews();
        }
        this.isSubmitting = false;
      },
      error: (err) => {
        this.toastService.error(err.error?.message || 'Σφάλμα υποβολής κριτικής');
        this.isSubmitting = false;
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
    this.editHoveredRating = 0;
    this.updateError = '';
  }

  setEditRating(rating: number): void {
    this.editRating = rating;
  }

  setEditHovered(rating: number): void {
    this.editHoveredRating = rating;
  }

  clearEditHovered(): void {
    this.editHoveredRating = 0;
  }

  getEditStarClass(star: number): string {
    const activeRating = this.editHoveredRating || this.editRating;
    return star <= activeRating ? 'star filled' : 'star';
  }

  updateReview(): void {
    if (this.editRating === 0) {
      this.updateError = 'Παρακαλώ επίλεξε rating!';
      return;
    }

    if (!this.editingReviewId) return;

    this.isUpdating = true;
    this.updateError = '';

    this.reviewService.updateReview(
      this.editingReviewId,
      this.editRating,
      this.editComment
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success) {
          this.toastService.success('Η κριτική ενημερώθηκε επιτυχώς!');
          this.cancelEdit();
          this.loadReviews();
        }
        this.isUpdating = false;
      },
      error: (err) => {
        this.toastService.error(err.error?.message || 'Σφάλμα ενημέρωσης κριτικής');
        this.isUpdating = false;
      }
    });
  }

  async deleteReview(reviewId: number): Promise<void> {
    const ok = await this.confirmService.confirm('Διαγραφή κριτικής;', { danger: true, confirmText: 'Διαγραφή' });
    if (!ok) return;

    this.reviewService.deleteReview(reviewId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toastService.success('Η κριτική διαγράφηκε');
        this.loadReviews();
        this.loadEligibility();
      },
      error: (err) => {
        this.toastService.error(err.error?.message || 'Σφάλμα διαγραφής');
      }
    });
  }

  get starsArray(): number[] {
    return [1, 2, 3, 4, 5];
  }

  isOwnReview(review: Review): boolean {
    return review.user_id === this.currentUserId;
  }
}