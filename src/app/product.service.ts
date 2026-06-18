import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface ProductImage {
  id: number;
  image_url: string;
  sort_order: number;
}

export interface ProductDto {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  image_url: string;
  category_id: number | null;
  category_name: string | null;
  created_at: string;
  average_rating: number | null;
  review_count: number;
  sizes?: string[] | null;
}

export interface ProductFilters {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getProducts(filters?: ProductFilters): Observable<{ success: boolean; products: ProductDto[] }> {
    
    
    let params = new HttpParams();

    if (filters?.search) {
      params = params.set('search', filters.search);
    }
    if (filters?.category && filters.category !== 'all') {
      params = params.set('category', filters.category);
    }
    if (filters?.minPrice !== undefined) {
      params = params.set('minPrice', filters.minPrice.toString());
    }
    if (filters?.maxPrice !== undefined) {
      params = params.set('maxPrice', filters.maxPrice.toString());
    }
    if (filters?.sort) {
      params = params.set('sort', filters.sort);
    }

    return this.http.get<{ success: boolean; products: ProductDto[] }>(
      `${this.baseUrl}/products`,
      { params }  // ← Προσθέτει τα params στο URL
    );
  }

  // ✅ ΝΕΟ: Φόρτωσε τις κατηγορίες για το dropdown
  getCategories(): Observable<{ success: boolean; categories: Category[] }> {
    return this.http.get<{ success: boolean; categories: Category[] }>(
      `${this.baseUrl}/categories`
    );
  }
  // Μέσα στην class ProductService, μετά το getProducts():

getProduct(id: number): Observable<{ success: boolean; product: ProductDto; galleryImages: ProductImage[] }> {
  return this.http.get<{ success: boolean; product: ProductDto; galleryImages: ProductImage[] }>(
    `${this.baseUrl}/products/${id}`
  );
}
}