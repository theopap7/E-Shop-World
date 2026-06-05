import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CreateOrderItemDto {
  productId: number;
  quantity: number;
  unitPrice: number;
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

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  createOrder(payload: CreateOrderDto): Observable<CreateOrderResponse> {
    return this.http.post<CreateOrderResponse>(`${this.baseUrl}/orders`, payload);
  }

  getMyOrders(): Observable<any> {
    return this.http.get(`${this.baseUrl}/my-orders`);
  }

  getOrderDetails(orderId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/my-orders/${orderId}`);
  }
  getAdminOrderDetails(orderId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/orders/${orderId}`);
  }

  downloadOrderPDF(orderId: number) {
    return this.http.get(`${this.baseUrl}/orders/${orderId}/pdf`, { responseType: 'blob' });
  }
}










