import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category_id: number;
  image_url: string;
  category_name?: string;
  created_at?: string;
  sizes?: string[] | null;
}

export interface CreateProductDto {
  name: string;
  description: string;
  price: number;
  stock: number;
  category_id: number | null;
  image_url: string;
  sizes?: string[] | null;
}

export interface AdminOrder {
  id: number;
  total_amount: number;
  status: string;
  created_at: string;
  recipient_name: string;
  phone: string;
  payment_status: string;
  user_email: string;
  first_name: string;
  last_name: string;
}

export interface AdminStats {
  totalOrders: number;
  totalRevenue: number;
  totalUsers: number;
  totalProducts: number;
  pendingOrders: number;
  pendingPayments: number;
  pendingReturns: number;
}

export interface AdminUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  created_at: string;
  order_count: number;
  total_spent: number;
  last_order_at: string | null;
}

export interface AdminReviewDto {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  product_id: number;
  user_id: number;
  product_name: string;
  product_image: string | null;
  first_name: string;
  last_name: string;
  email: string;
}

interface ApiResponse {
  success: boolean;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly baseUrl = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  // ========== PRODUCTS ==========

  getProducts(): Observable<{ success: boolean; products: Product[] }> {
    return this.http.get<{ success: boolean; products: Product[] }>(`${this.baseUrl}/products`);
  }

  getProduct(id: number): Observable<{ success: boolean; product: Product }> {
    return this.http.get<{ success: boolean; product: Product }>(`${this.baseUrl}/products/${id}`);
  }

  createProduct(product: CreateProductDto): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.baseUrl}/products`, product);
  }

  updateProduct(id: number, product: CreateProductDto): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.baseUrl}/products/${id}`, product);
  }

  deleteProduct(id: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.baseUrl}/products/${id}`);
  }

  // ========== ORDERS ==========

  getOrders(): Observable<{ success: boolean; orders: AdminOrder[] }> {
    return this.http.get<{ success: boolean; orders: AdminOrder[] }>(`${this.baseUrl}/orders`);
  }

  updateOrderStatus(orderId: number, status: string): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.baseUrl}/orders/${orderId}/status`, { status });
  }

  confirmPayment(orderId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.baseUrl}/orders/${orderId}/confirm-payment`, {});
  }

  // ========== USERS ==========

  getUsers(): Observable<{ success: boolean; users: AdminUser[] }> {
    return this.http.get<{ success: boolean; users: AdminUser[] }>(`${this.baseUrl}/users`);
  }

  // ========== STATS ==========

  getStats(): Observable<{ success: boolean; stats: AdminStats }> {
    return this.http.get<{ success: boolean; stats: AdminStats }>(`${this.baseUrl}/stats`);
  }

getAllReviews(): Observable<{ success: boolean; reviews: AdminReviewDto[] }> {
  return this.http.get<{ success: boolean; reviews: AdminReviewDto[] }>(
    `${this.baseUrl}/reviews`
  );
}

deleteReview(reviewId: number): Observable<{ success: boolean; message?: string }> {
  return this.http.delete<{ success: boolean; message?: string }>(
    `${environment.apiUrl}/reviews/${reviewId}`
  );
}

downloadOrderPDF(orderId: number) {
  return this.http.get(
    `${environment.apiUrl}/orders/${orderId}/pdf`,
    { responseType: 'blob' }
  );
}

downloadOrderCSV(orderId: number) {
  return this.http.get(
    `${this.baseUrl}/orders/${orderId}/csv`,
    { responseType: 'blob' }
  );
}
}
