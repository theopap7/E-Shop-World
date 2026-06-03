import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { OrderService } from '../order.service';
import { AdminService } from '../admin.service';
import { ToastService } from '../toast.service';

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
  imports: [CommonModule, RouterModule],
  templateUrl: './order-details.html',
  styleUrl: './order-details.css',
})
export class OrderDetailsComponent implements OnInit {

  orderId!: number;

  isLoading = true;
  error: string | null = null;

  order: OrderDto | null = null;
  items: OrderItemDto[] = [];

  // 🔵 για admin / user navigation
  isAdminPage = false;

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

  statusLabel(s: string): string {
    const x = (s || '').toLowerCase();
    if (x === 'pending') return 'Σε Επεξεργασία';
    if (x === 'paid') return 'Πληρωμένη';
    if (x === 'shipped') return 'Αποστολή';
    if (x === 'delivered') return 'Παραδόθηκε';
    if (x === 'completed') return 'Ολοκληρωμένη';
    if (x === 'cancelled') return 'Ακυρώθηκε';
    return s || '—';
  }

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
    this.adminService.confirmPayment(this.orderId).subscribe({
      next: () => {
        this.toastService.success('Η πληρωμή επιβεβαιώθηκε!');
        this.loadDetails();
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'Αποτυχία επιβεβαίωσης');
      }
    });
  }

downloadPDF(orderId: number) {

  this.adminService.downloadOrderPDF(orderId).subscribe(blob => {

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `order-${orderId}.pdf`;
    a.click();

    window.URL.revokeObjectURL(url);

  });

}
}