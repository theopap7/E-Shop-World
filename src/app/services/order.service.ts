import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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

export interface CreateOrderDto {
  items: CreateOrderItemDto[];
  recipientName: string;
  phone: string;
  shipping: ShippingDto;
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  paymentIban?: string;
  discountCode?: string;
  discountAmount?: number;
  isGift?: boolean;
  giftMessage?: string;
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

export type ReturnRequestStatus = 'pending' | 'approved' | 'rejected' | 'partially_approved';
export type ReturnItemStatus = 'pending' | 'approved' | 'rejected';

export interface ReturnItem {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  size?: string | null;
  status: ReturnItemStatus;
  reason?: string | null;
  image_url?: string | null;
}

export interface OrderSummary {
  id: number;
  total_amount: number;
  status: string;
  created_at: string;
  return_statuses?: ReturnItemStatus[];
  return_products?: { name: string; status: ReturnItemStatus }[];
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
    is_gift?: boolean | number;
    gift_message?: string | null;
    first_name?: string;
    last_name?: string;
    email?: string;
    customer_phone?: string | null;
  };
  items: OrderDetailItem[];
  returnRequest?: {
    id: number;
    status: ReturnRequestStatus;
    reason: string | null;
    admin_note?: string | null;
    created_at: string;
  } | null;
  returnResolvedItems?: { product_id: number; size: string | null; status: 'approved' | 'rejected' }[];
  returnRequests?: {
    id: number;
    status: ReturnRequestStatus;
    reason: string | null;
    admin_note?: string | null;
    refund_amount: number;
    created_at: string;
    items: ReturnItem[];
  }[];
}

export interface MyReturnRow {
  id: number;
  order_id: number;
  reason: string | null;
  status: ReturnRequestStatus;
  admin_note: string | null;
  refund_amount: number;
  created_at: string;
  items: ReturnItem[];
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

  getMyReturns(): Observable<{ success: boolean; returns: MyReturnRow[] }> {
    return this.http.get<{ success: boolean; returns: MyReturnRow[] }>(`${this.baseUrl}/my-returns`);
  }

  cancelOrder(orderId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.baseUrl}/orders/${orderId}/cancel`, {});
  }

  submitReturnRequest(orderId: number, items: { productId: number; quantity: number; size?: string | null; reason: string }[]): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.baseUrl}/orders/${orderId}/return`, { items });
  }

  downloadOrderPDF(orderId: number) {
    return this.http.get(`${this.baseUrl}/orders/${orderId}/pdf`, { responseType: 'blob' });
  }
}
