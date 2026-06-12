import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface CreateOrderItemDto {
  productId: number;
  quantity: number;
  unitPrice: number;
  size?: string;
}

export interface ShippingDto {
  country?: string;
  city: string;
  zip: string;
  address1: string;
  floor?: string;
  notes?: string;
}

export type ShippingMethod = 'courier_standard' | 'courier_express' | 'pickup';
export type PaymentMethod = 'cod' | 'card_mock' | 'bank_transfer';

export interface CardDto {
  number: string;
  holder: string;
  exp: string;
  cvv: string;
}

export interface CreateOrderDto {
  items: CreateOrderItemDto[];
  recipientName: string;
  phone: string;
  shipping: ShippingDto;
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  paymentIban?: string;
  card?: CardDto;
  discountCode?: string;
  discountAmount?: number;

}

export interface CreateOrderResponse {
  success: boolean;
  message: string;
  orderId?: number;
  subtotal?: number;
  shippingCost?: number;
  totalAmount?: number;
  paymentStatus?: string;
}

export interface OrderSummary {
  id: number;
  total_amount: number;
  status: string;
  created_at: string;
  return_status?: string | null;
}

export interface OrderDetailItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  size?: string;
  stock?: number;
  image_url?: string;
}

export interface OrderDetailResponse {
  success: boolean;
  order: {
    id: number;
    total_amount: number;
    status: string;
    created_at: string;
    recipient_name: string;
    phone: string;
    ship_country: string;
    ship_city: string;
    ship_zip: string;
    ship_address1: string;
    ship_notes?: string;
    floor?: string;
    shipping_method: string;
    shipping_cost: number;
    payment_method: string;
    payment_status: string;
    subtotal: number;
    discount_code?: string | null;
    discount_amount?: number | null;
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  items: OrderDetailItem[];
  returnRequest?: {
    id: number;
    status: 'pending' | 'approved' | 'rejected';
    reason: string;
    admin_note?: string | null;
    created_at: string;
  } | null;
}

interface ApiResponse {
  success: boolean;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  createOrder(payload: CreateOrderDto): Observable<CreateOrderResponse> {
    return this.http.post<CreateOrderResponse>(`${this.baseUrl}/orders`, payload);
  }

  getMyOrders(): Observable<{ success: boolean; orders: OrderSummary[] }> {
    return this.http.get<{ success: boolean; orders: OrderSummary[] }>(`${this.baseUrl}/my-orders`);
  }

  getOrderDetails(orderId: number): Observable<OrderDetailResponse> {
    return this.http.get<OrderDetailResponse>(`${this.baseUrl}/my-orders/${orderId}`);
  }

  getAdminOrderDetails(orderId: number): Observable<OrderDetailResponse> {
    return this.http.get<OrderDetailResponse>(`${this.baseUrl}/admin/orders/${orderId}`);
  }

  cancelOrder(orderId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.baseUrl}/orders/${orderId}/cancel`, {});
  }

  submitReturnRequest(orderId: number, reason: string, items: { productId: number; quantity: number }[]): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.baseUrl}/orders/${orderId}/return`, { reason, items });
  }

  downloadOrderPDF(orderId: number) {
    return this.http.get(`${this.baseUrl}/orders/${orderId}/pdf`, { responseType: 'blob' });
  }
}










