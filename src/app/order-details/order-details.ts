import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { OrderService } from '../order.service';
import { AdminService } from '../admin.service';
import { ToastService } from '../toast.service';
import { statusLabel } from '../order-status.util';

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
  subtotal: number;
  discount_code?: string | null;
  discount_amount?: number | null;
  first_name?: string;
  last_name?: string;
  email?: string;
  return_request?: {
    id: number;
    status: 'pending' | 'approved' | 'rejected';
    reason: string;
    admin_note?: string | null;
    created_at: string;
  } | null;
};

type OrderItemDto = {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

@Component({
  selector: 'app-order-details',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
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

  showReturnForm = false;
  returnReason = '';
  isSubmittingReturn = false;
  returnItems: { productId: number; productName: string; maxQty: number; selectedQty: number; selected: boolean; unitPrice: number }[] = [];

  get returnTotal(): number {
    return this.returnItems
      .filter(i => i.selected && i.selectedQty > 0)
      .reduce((sum, i) => sum + i.selectedQty * i.unitPrice, 0);
  }

  get selectedReturnItems() {
    return this.returnItems.filter(i => i.selected && i.selectedQty > 0);
  }

  get canCancel(): boolean {
    return !this.isAdminPage && this.order?.status === 'pending';
  }

  get canReturn(): boolean {
    return !this.isAdminPage && this.order?.status === 'delivered' && !this.order?.return_request;
  }

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService,
    private router: Router,
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {

    // ελέγχει αν είμαστε στο admin panel
    this.isAdminPage = this.router.url.startsWith('/admin');

    const idParam = this.route.snapshot.paramMap.get('orderId');
    const id = Number(idParam);

    if (!Number.isFinite(id)) {
      this.error = 'Μη έγκυρο order id.';
      this.isLoading = false;
      return;
    }

    this.orderId = id;
    this.loadDetails();
  }

  loadDetails(): void {

    this.isLoading = true;
    this.error = null;

    const request = this.isAdminPage
      ? this.orderService.getAdminOrderDetails(this.orderId)
      : this.orderService.getOrderDetails(this.orderId);

    request.subscribe({
      next: (res: any) => {
        this.order = res?.order ?? null;
        if (this.order) this.order.return_request = res?.returnRequest ?? null;
        this.items = res?.items ?? [];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('getOrderDetails error:', err);
        this.error = err?.error?.message || 'Αποτυχία φόρτωσης λεπτομερειών.';
        this.isLoading = false;
      },
    });
  }

  statusLabel = statusLabel;

  shippingMethodLabel(method: string): string {
    if (method === 'courier_standard') return 'Τυπική Αποστολή';
    if (method === 'courier_express') return 'Γρήγορη Αποστολή';
    if (method === 'pickup') return 'Παραλαβή από κατάστημα';
    return method || '—';
  }

  paymentMethodLabel(method: string): string {
    if (method === 'cod') return 'Αντικαταβολή';
    if (method === 'card_mock') return 'Κάρτα';
    if (method === 'bank_transfer') return 'Τραπεζική κατάθεση';
    return method || '—';
  }

  paymentStatusLabel(status: string): string {
    const x = (status || '').toUpperCase();
    if (x === 'PAID') return 'Πληρωμένη';
    if (x === 'PENDING') return 'Σε εκκρεμότητα';
    if (x === 'REFUNDED') return 'Επιστροφή χρημάτων';
    if (x === 'FAILED') return 'Αποτυχία';
    return status || '—';
  }

  cancelOrder(): void {
    if (!confirm('Είσαι σίγουρος ότι θέλεις να ακυρώσεις την παραγγελία;')) return;

    this.isCancelling = true;
    this.orderService.cancelOrder(this.orderId).subscribe({
      next: () => {
        this.toastService.success('Η παραγγελία ακυρώθηκε επιτυχώς');
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
      maxQty: i.quantity,
      selectedQty: i.quantity,
      selected: false,
      unitPrice: i.unit_price
    }));
    this.showReturnForm = true;
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
    const items = this.selectedReturnItems.map(i => ({ productId: i.productId, quantity: i.selectedQty }));
    this.orderService.submitReturnRequest(this.orderId, this.returnReason, items).subscribe({
      next: () => {
        this.toastService.success('Το αίτημα επιστροφής υποβλήθηκε!');
        this.showReturnForm = false;
        this.returnReason = '';
        this.loadDetails();
        this.isSubmittingReturn = false;
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'Αποτυχία υποβολής αιτήματος');
        this.isSubmittingReturn = false;
      }
    });
  }

  returnStatusLabel(status: string): string {
    if (status === 'pending') return 'Σε Αναμονή';
    if (status === 'approved') return 'Εγκρίθηκε';
    if (status === 'rejected') return 'Απορρίφθηκε';
    return status;
  }

  get itemsTotal(): number {
    return this.items.reduce((sum, i) => sum + (Number(i.line_total) || 0), 0);
  }
downloadCSV(orderId: number) {

  this.adminService.downloadOrderCSV(orderId).subscribe(blob => {

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `order-${orderId}.csv`;
    a.click();

    window.URL.revokeObjectURL(url);

  });

}


  confirmPayment(): void {
    if (this.isConfirmingPayment) return;
    this.isConfirmingPayment = true;
    this.adminService.confirmPayment(this.orderId).subscribe({
      next: () => {
        this.toastService.success('Η πληρωμή επιβεβαιώθηκε!');
        this.isConfirmingPayment = false;
        this.loadDetails();
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'Αποτυχία επιβεβαίωσης');
        this.isConfirmingPayment = false;
      }
    });
  }

downloadPDF(orderId: number) {
  this.orderService.downloadOrderPDF(orderId).subscribe({
    next: blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `order-${orderId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
    error: () => this.toastService.error('Αποτυχία λήψης PDF')
  });
}
}