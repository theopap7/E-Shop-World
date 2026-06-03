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
}

export interface CreateProductDto {
  name: string;
  description: string;
  price: number;
  stock: number;
  category_id: number | null;
  image_url: string;
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
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly baseUrl = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  // ========== PRODUCTS ==========
  
  getProducts(): Observable<any> {
    return this.http.get(`${this.baseUrl}/products`);
  }

  getProduct(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/products/${id}`);
  }

  createProduct(product: CreateProductDto): Observable<any> {
    return this.http.post(`${this.baseUrl}/products`, product);
  }

  updateProduct(id: number, product: CreateProductDto): Observable<any> {
    return this.http.put(`${this.baseUrl}/products/${id}`, product);
  }

  deleteProduct(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/products/${id}`);
  }

  // ========== ORDERS ==========
  
  getOrders(): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders`);
  }

  updateOrderStatus(orderId: number, status: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/orders/${orderId}/status`, { status });
  }

  confirmPayment(orderId: number): Observable<any> {
    return this.http.patch(`${this.baseUrl}/orders/${orderId}/confirm-payment`, {});
  }

  // ========== STATS ==========
  
  getStats(): Observable<any> {
    return this.http.get(`${this.baseUrl}/stats`);
  }
  
getAllReviews(): Observable<{ success: boolean; reviews: any[] }> {
  return this.http.get<{ success: boolean; reviews: any[] }>(
    `${this.baseUrl}/reviews`  // ✅ Χωρίς /admin
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
