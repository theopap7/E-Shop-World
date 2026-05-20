import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReviewService, Review } from '../review.service';
import { AuthService } from '../auth.service';
import { ToastService } from '../toast.service';  // ✅ ADD

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  submitSuccess = '';

  // Edit state
  editingReviewId: number | null = null;
  editRating = 0;
  editComment = '';
  editHoveredRating = 0;
  isUpdating = false;
  updateError = '';

  isLoggedIn = false;
  currentUserId: number | null = null;

  get hasExistingReview(): boolean {
    if (!this.currentUserId) return false;
    return this.reviews.some(r => r.user_id === this.currentUserId);
  }

  // ✅ INJECT ToastService
  constructor(
    private reviewService: ReviewService,
    private authService: AuthService,
    private toastService: ToastService  // ✅ ADD
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    const user = this.authService.getUser();
    this.currentUserId = user?.id || null;
    this.loadReviews();
  }

  loadReviews(): void {
    this.isLoading = true;

    this.reviewService.getReviews(this.productId).subscribe({
      next: (res) => {
        this.reviews = res.reviews;
        this.average = res.average;
        this.total = res.total;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Load reviews error:', err);
        this.isLoading = false;
      }
    });
  }

  // ===== NEW REVIEW METHODS =====
  
  setRating(rating: number): void {
    this.newRating = rating;
  }

  setHovered(rating: number): void {
    this.hoveredRating = rating;
  }

  clearHovered(): void {
    this.hoveredRating = 0;
  }

  getStarClass(star: number): string {
    const activeRating = this.hoveredRating || this.newRating;
    return star <= activeRating ? 'star filled' : 'star';
  }

  getReviewStars(rating: number): string {
    return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  submitReview(): void {
    if (this.newRating === 0) {
      this.submitError = 'Παρακαλώ επίλεξε rating!';
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';
    this.submitSuccess = '';

    this.reviewService.submitReview(
      this.productId,
      this.newRating,
      this.newComment
    ).subscribe({
      next: (res) => {
        if (res.success) {
          // ✅ Toast instead of inline message
          this.toastService.success('Η κριτική σου υποβλήθηκε επιτυχώς! ⭐');
          this.newRating = 0;
          this.newComment = '';
          this.loadReviews();
        }
        this.isSubmitting = false;
      },
      error: (err) => {
        // ✅ Toast for error
        this.toastService.error(err.error?.message || 'Σφάλμα υποβολής κριτικής');
        this.isSubmitting = false;
      }
    });
  }

  // ===== EDIT REVIEW METHODS =====

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
    ).subscribe({
      next: (res) => {
        if (res.success) {
          // ✅ Toast: Updated
          this.toastService.success('Η κριτική ενημερώθηκε επιτυχώς!');
          this.cancelEdit();
          this.loadReviews();
        }
        this.isUpdating = false;
      },
      error: (err) => {
        // ✅ Toast: Error
        this.toastService.error(err.error?.message || 'Σφάλμα ενημέρωσης κριτικής');
        this.isUpdating = false;
      }
    });
  }

  // ===== DELETE REVIEW =====

  deleteReview(reviewId: number): void {
    if (!confirm('Διαγραφή κριτικής;')) return;

    this.reviewService.deleteReview(reviewId).subscribe({
      next: () => {
        // ✅ Toast: Deleted
        this.toastService.success('Η κριτική διαγράφηκε');
        this.reviews = this.reviews.filter(r => r.id !== reviewId);
        this.loadReviews();
      },
      error: (err) => {
        // ✅ Toast: Error
        this.toastService.error(err.error?.message || 'Σφάλμα διαγραφής');
      }
    });
  }

  // ===== HELPERS =====

  get starsArray(): number[] {
    return [1, 2, 3, 4, 5];
  }

  isOwnReview(review: Review): boolean {
    return review.user_id === this.currentUserId;
  }
}