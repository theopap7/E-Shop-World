import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { Subject, EMPTY } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { OrderService, OrderDetailResponse } from '../services/order.service';
import { AdminService } from '../services/admin.service';
import { ToastService } from '../services/toast.service';
import { ConfirmService } from '../services/confirm.service';
import { CartService } from '../services/cart.service';
import { statusLabel } from '../services/order-status.util';
import { paymentMethodLabel, paymentStatusLabel, shippingMethodLabel } from '../services/order-labels.util';
import { returnStatusLabel as returnStatusLabelUtil } from '../services/return-status.util';
import { ImageUrlPipe } from '../shared/image-url.pipe';
import { STORE_BANK_ACCOUNT, formatIban } from '../shared/store-bank';

type OrderDto = {
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
  payment_iban?: string | null;
  subtotal: number;
  discount_code?: string | null;
  discount_amount?: number | null;
  is_gift?: boolean | number;
  gift_message?: string | null;
  first_name?: string;
  last_name?: string;
  email?: string;
  customer_phone?: string | null;
  return_request?: {
    id: number;
    status: 'pending' | 'approved' | 'rejected';
    reason: string;
    admin_note?: string | null;
    created_at: string;
  } | null;
};

function lineKey(productId: number, size: string | null | undefined): string {
  return `${productId}::${size || ''}`;
}

type OrderItemDto = {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  size?: string;
  stock?: number;
  image_url?: string;
};

@Component({
  selector: 'app-order-details',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ImageUrlPipe],
  templateUrl: './order-details.html',
  styleUrl: './order-details.css',
})
export class OrderDetailsComponent implements OnInit {

  orderId = 0;

  isLoading = true;
  error: string | null = null;

  order: OrderDto | null = null;
  items: OrderItemDto[] = [];

  isAdminPage = false;
  isCancelling = false;
  isConfirmingPayment = false;
  isReordering = false;

  showReturnForm = false;
  returnReason = '';
  isSubmittingReturn = false;
  returnItems: { productId: number; productName: string; size: string | null; maxQty: number; selectedQty: number; selected: boolean; unitPrice: number; blockedStatus: 'approved' | 'rejected' | null }[] = [];
  returnResolvedByLine: Record<string, 'approved' | 'rejected'> = {};
  returnRequests: NonNullable<OrderDetailResponse['returnRequests']> = [];

  get discountRatio(): number {
    const subtotal = Number(this.order?.subtotal ?? 0);
    const discount = Number(this.order?.discount_amount ?? 0);
    return subtotal > 0 ? discount / subtotal : 0;
  }

  refundFor(item: { selectedQty: number; unitPrice: number }): number {
    return item.selectedQty * Number(item.unitPrice) * (1 - this.discountRatio);
  }

  get returnTotal(): number {
    const returnedSubtotal = this.selectedReturnItems
      .reduce((sum, i) => sum + i.selectedQty * Number(i.unitPrice), 0);
    const refund = Number((returnedSubtotal * (1 - this.discountRatio)).toFixed(2));
    return Math.min(refund, Number(this.order?.total_amount ?? 0));
  }

  get selectedReturnItems() {
    return this.returnItems.filter(i => i.selected && i.selectedQty > 0);
  }

  get canCancel(): boolean {
    return !this.isAdminPage && this.order?.status === 'pending';
  }

  get canReturn(): boolean {
    if (this.isAdminPage || this.order?.status !== 'delivered') return false;
    if (this.order?.return_request?.status === 'pending') return false;
    return this.items.some(i => !this.returnResolvedByLine[lineKey(i.product_id, i.size)]);
  }

  private destroyRef = inject(DestroyRef);
  private reload$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService,
    private router: Router,
    private adminService: AdminService,
    private toastService: ToastService,
    private cartService: CartService,
    private confirmService: ConfirmService
  ) {}

  ngOnInit(): void {
    this.isAdminPage = this.router.url.startsWith('/admin');

    // switchMap cancels any in-flight request when a newer one comes in (route change
    // or a manual reload), so a slow response can't overwrite a newer one's data.
    // Subscribed before paramMap below, since paramMap emits synchronously on subscribe
    // and would otherwise fire loadDetails() -> reload$.next() before anyone is listening.
    this.reload$.pipe(
      switchMap(() => {
        this.isLoading = true;
        this.error = null;

        const request = this.isAdminPage
          ? this.orderService.getAdminOrderDetails(this.orderId)
          : this.orderService.getOrderDetails(this.orderId);

        return request.pipe(
          catchError(err => {
            this.error = err?.error?.message || 'Αποτυχία φόρτωσης λεπτομερειών.';
            this.isLoading = false;
            return EMPTY;
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((res: OrderDetailResponse) => {
      this.order = res?.order ?? null;
      if (this.order) this.order.return_request = res?.returnRequest ?? null;
      this.items = res?.items ?? [];
      this.returnResolvedByLine = {};
      for (const r of res?.returnResolvedItems ?? []) {
        this.returnResolvedByLine[lineKey(r.product_id, r.size)] = r.status;
      }
      this.returnRequests = res?.returnRequests ?? [];
      this.isLoading = false;
    });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = Number(params.get('orderId'));

      if (!Number.isFinite(id)) {
        this.error = 'Μη έγκυρος αριθμός παραγγελίας.';
        this.isLoading = false;
        return;
      }

      this.orderId = id;
      this.loadDetails();
    });
  }

  loadDetails(): void {
    this.reload$.next();
  }

  statusLabel = statusLabel;
  formatIban = formatIban;
  readonly storeBank = STORE_BANK_ACCOUNT;

  shippingMethodLabel = shippingMethodLabel;
  paymentMethodLabel = paymentMethodLabel;
  paymentStatusLabel = paymentStatusLabel;

  async cancelOrder(): Promise<void> {
    const ok = await this.confirmService.confirm('Είσαι σίγουρος ότι θέλεις να ακυρώσεις την παραγγελία;', { danger: true, title: 'Ακύρωση παραγγελίας', confirmText: 'Ακύρωση παραγγελίας', cancelText: 'Πίσω' });
    if (!ok) return;

    this.isCancelling = true;
    this.orderService.cancelOrder(this.orderId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toastService.success('Η παραγγελία ακυρώθηκε επιτυχώς');
        this.adminService.invalidateStatsCache();
        this.loadDetails();
        this.isCancelling = false;
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'Αποτυχία ακύρωσης παραγγελίας');
        this.isCancelling = false;
      }
    });
  }

  initReturnForm(): void {
    this.returnItems = this.items.map(i => ({
      productId: i.product_id,
      productName: i.product_name,
      size: i.size ?? null,
      maxQty: i.quantity,
      selectedQty: i.quantity,
      selected: false,
      unitPrice: i.unit_price,
      blockedStatus: this.returnResolvedByLine[lineKey(i.product_id, i.size)] ?? null
    }));
    this.showReturnForm = true;
  }

  blockedStatusLabel(status: 'approved' | 'rejected'): string {
    return status === 'approved' ? 'Έχει ήδη επιστραφεί' : 'Έχει ήδη απορριφθεί';
  }

  submitReturn(): void {
    if (!this.returnReason.trim()) {
      this.toastService.warning('Συμπλήρωσε τον λόγο επιστροφής');
      return;
    }
    if (this.selectedReturnItems.length === 0) {
      this.toastService.warning('Επίλεξε τουλάχιστον ένα προϊόν');
      return;
    }
    this.isSubmittingReturn = true;
    const items = this.selectedReturnItems.map(i => ({ productId: i.productId, quantity: i.selectedQty, size: i.size }));
    this.orderService.submitReturnRequest(this.orderId, this.returnReason, items).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toastService.success('Το αίτημα επιστροφής υποβλήθηκε!');
        this.showReturnForm = false;
        this.returnReason = '';
        this.adminService.invalidateStatsCache();
        this.loadDetails();
        this.isSubmittingReturn = false;
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'Αποτυχία υποβολής αιτήματος');
        this.isSubmittingReturn = false;
      }
    });
  }

  returnStatusLabel = returnStatusLabelUtil;

  reorderAll(): void {
    if (this.isReordering || this.items.length === 0) return;
    this.isReordering = true;
    this.cartService.reorderItems(this.items.map(i => ({
      id: i.product_id,
      name: i.product_name,
      price: i.unit_price,
      quantity: i.quantity,
      stock: i.stock ?? 0,
      image_url: i.image_url,
      size: i.size,
    })));
    this.isReordering = false;
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  downloadCSV(orderId: number) {
    this.adminService.downloadOrderCSV(orderId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => this.triggerDownload(blob, `order-${orderId}.csv`),
      error: () => this.toastService.error('Αποτυχία λήψης CSV')
    });
  }

  confirmPayment(): void {
    if (this.isConfirmingPayment) return;
    this.isConfirmingPayment = true;
    this.adminService.confirmPayment(this.orderId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toastService.success('Η πληρωμή επιβεβαιώθηκε!');
        this.isConfirmingPayment = false;
        this.adminService.invalidateStatsCache();
        this.loadDetails();
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'Αποτυχία επιβεβαίωσης');
        this.isConfirmingPayment = false;
      }
    });
  }

  downloadPDF(orderId: number) {
    this.orderService.downloadOrderPDF(orderId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => this.triggerDownload(blob, `order-${orderId}.pdf`),
      error: () => this.toastService.error('Αποτυχία λήψης PDF')
    });
  }
}