import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface Review {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  first_name?: string;
  last_name?: string;
  user_id: number;
  product_id?: number;
  product_name?: string;
  product_image?: string | null;
}

export interface ReviewsResponse {
  success: boolean;
  reviews: Review[];
  average: number;
  total: number;
}

export interface MyReviewsResponse {
  success: boolean;
  reviews: Review[];
}

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Πάρε reviews για ένα product
  getReviews(productId: number): Observable<ReviewsResponse> {
    return this.http.get<ReviewsResponse>(
      `${this.baseUrl}/reviews/${productId}`
    );
  }

  // Πάρε τις κριτικές του logged-in χρήστη
  getMyReviews(): Observable<MyReviewsResponse> {
    return this.http.get<MyReviewsResponse>(
      `${this.baseUrl}/reviews/my`
    );
  }

  submitReview(productId: number, rating: number, comment: string): Observable<{ success: boolean; message?: string }> {
    return this.http.post<{ success: boolean; message?: string }>(
      `${this.baseUrl}/reviews/${productId}`,
      { rating, comment }
    );
  }

  deleteReview(reviewId: number): Observable<{ success: boolean; message?: string }> {
    return this.http.delete<{ success: boolean; message?: string }>(`${this.baseUrl}/reviews/${reviewId}`);
  }

  updateReview(reviewId: number, rating: number, comment: string): Observable<{ success: boolean; message?: string }> {
    return this.http.put<{ success: boolean; message?: string }>(
      `${this.baseUrl}/reviews/${reviewId}`,
      { rating, comment }
    );
  }
}