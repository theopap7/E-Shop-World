import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subscription, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

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
  sizeStock?: Record<string, number> | null;
}

export interface CreateProductDto {
  name: string;
  description: string;
  price: number;
  stock: number;
  category_id: number | null;
  image_url: string;
  sizes?: string[] | null;
  sizeStock?: Record<string, number>;
}

export interface AdminOrder {
  id: number;
  total_amount: number;
  status: string;
  created_at: string;
  recipient_name: string;
  phone: string;
  payment_status: string;
  payment_method: string;
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

export interface ChartData {
  dailyOrders: { day: string; orders: number; revenue: number }[];
  statusBreakdown: { status: string; count: number }[];
  topProducts: { name: string; total_sold: number }[];
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

export interface AdminCategory {
  id: number;
  name: string;
  created_at: string;
  product_count: number;
}

export interface CreateCategoryDto {
  name: string;
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
  productId?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService implements OnDestroy {
  private readonly baseUrl = `${environment.apiUrl}/admin`;
  private authSub: Subscription;

  constructor(private http: HttpClient, private auth: AuthService) {
    this.authSub = this.auth.user$.subscribe(() => this.invalidateStatsCache());
  }

  ngOnDestroy(): void {
    this.authSub.unsubscribe();
  }

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

  getOrders(): Observable<{ success: boolean; orders: AdminOrder[] }> {
    return this.http.get<{ success: boolean; orders: AdminOrder[] }>(`${this.baseUrl}/orders`);
  }

  updateOrderStatus(orderId: number, status: string): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.baseUrl}/orders/${orderId}/status`, { status });
  }

  confirmPayment(orderId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.baseUrl}/orders/${orderId}/confirm-payment`, {});
  }

  getUsers(): Observable<{ success: boolean; users: AdminUser[] }> {
    return this.http.get<{ success: boolean; users: AdminUser[] }>(`${this.baseUrl}/users`);
  }

  private statsCache$: Observable<{ success: boolean; stats: AdminStats; charts: ChartData }> | null = null;

  getDashboardData(): Observable<{ success: boolean; stats: AdminStats; charts: ChartData }> {
    if (!this.statsCache$) {
      this.statsCache$ = this.http
        .get<{ success: boolean; stats: AdminStats; charts: ChartData }>(`${this.baseUrl}/stats`)
        .pipe(shareReplay(1));
    }
    return this.statsCache$;
  }

  invalidateStatsCache(): void {
    this.statsCache$ = null;
  }

  getChartsForRange(range: string): Observable<{ success: boolean } & ChartData> {
    return this.http.get<{ success: boolean } & ChartData>(
      `${this.baseUrl}/stats/charts`,
      { params: { range } }
    );
  }

  getCategories(): Observable<{ success: boolean; categories: AdminCategory[] }> {
    return this.http.get<{ success: boolean; categories: AdminCategory[] }>(`${this.baseUrl}/categories`);
  }

  createCategory(category: CreateCategoryDto): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.baseUrl}/categories`, category);
  }

  updateCategory(id: number, category: CreateCategoryDto): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.baseUrl}/categories/${id}`, category);
  }

  deleteCategory(id: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.baseUrl}/categories/${id}`);
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
