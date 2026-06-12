import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, AdminReviewDto } from '../admin.service';
import { RouterModule } from '@angular/router';
import { ToastService } from '../toast.service';

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-reviews.html',
  styleUrl: './admin-reviews.css'
})
export class AdminReviewsComponent implements OnInit {

  reviews: AdminReviewDto[] = [];
  isLoading = false;
  error = '';

  constructor(private adminService: AdminService, private toastService: ToastService) {}

  ngOnInit(): void {
    this.loadReviews();
  }

  loadReviews(): void {
    this.isLoading = true;
    this.error = '';

    this.adminService.getAllReviews().subscribe({
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

    this.adminService.deleteReview(reviewId).subscribe({
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

  // Helper: Star display
  getStars(rating: number): string {
    return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  }
}