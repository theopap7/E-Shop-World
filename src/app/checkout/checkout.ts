import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule
} from '@angular/forms';
import { Subscription } from 'rxjs';

import { CartService, CartItem } from '../cart.service';
import { OrderService, CreateOrderDto } from '../order.service';
import { DiscountService } from '../discount.service';
import { ToastService } from '../toast.service';

type ShippingMethod = 'courier_standard' | 'courier_express' | 'pickup';
type PaymentMethod = 'cod' | 'card_mock' | 'bank_transfer';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css',
})
export class CheckoutComponent implements OnInit, OnDestroy {
  items: CartItem[] = [];
  subtotal = 0;
  shippingCost = 0;
  
  // Discount state
  discountCode = '';
  discountAmount = 0;
  appliedDiscount: any = null;
  discountError = '';
  applyingDiscount = false;

  isSubmitting = false;
  error: string | null = null;
  success: string | null = null;

  private sub?: Subscription;

  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private cart: CartService,
    private orders: OrderService,
    private router: Router,
    private discountService: DiscountService,
    private toastService: ToastService
  ) {
    this.form = this.fb.group({
      recipientName: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.pattern(/^(\+30|0030)?[269]\d{9}$/)]],

      shipping: this.fb.group({
        country: ['ΕΛΛΑΔΑ', Validators.required],
        city: ['', [Validators.required]],
        zip: ['', [Validators.required]],
        address1: ['', [Validators.required]],
        floor: [''],
        notes: [''],
      }),

      shippingMethod: ['courier_standard' as ShippingMethod, [Validators.required]],
      paymentMethod: ['cod' as PaymentMethod, [Validators.required]],

      paymentDetails: this.fb.group({
        iban: [''],
        cardNumber: [''],
        cardHolder: [''],
        cardExp: [''],
        cardCvv: [''],
      }),

      acceptTerms: [false, [Validators.requiredTrue]],
    });
  }

  ngOnInit(): void {
    this.sub = this.cart.items$.subscribe((items) => {
      this.items = items;
      this.subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
      if (this.appliedDiscount) {
        if (this.appliedDiscount.type === 'percentage') {
          this.discountAmount = +(this.subtotal * this.appliedDiscount.value / 100).toFixed(2);
        } else {
          this.discountAmount = Math.min(this.appliedDiscount.value, this.subtotal);
        }
      }
      this.recalcTotals();
    });

    this.form.get('shippingMethod')!.valueChanges.subscribe(() => {
      this.recalcTotals();
      this.applyShippingValidators();
    });
    this.form.get('paymentMethod')!.valueChanges.subscribe(() => this.applyPaymentValidators());
    this.applyPaymentValidators();
    this.applyShippingValidators();

    if (this.cart.getItems().length === 0) {
      this.router.navigate(['/cart']);
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get total(): number {
    const base = this.subtotal + this.shippingCost - this.discountAmount;
    return Math.max(0, Number(base.toFixed(2)));
  }

  private recalcTotals(): void {
    const method = this.form.get('shippingMethod')!.value as ShippingMethod;

    this.shippingCost =
      method === 'courier_express' ? 6 :
      method === 'courier_standard' ? 3 :
      0;
  }

  private applyPaymentValidators(): void {
    const method = this.form.get('paymentMethod')!.value as PaymentMethod;

    const iban = this.form.get('paymentDetails.iban')!;
    const cardNumber = this.form.get('paymentDetails.cardNumber')!;
    const cardHolder = this.form.get('paymentDetails.cardHolder')!;
    const cardExp = this.form.get('paymentDetails.cardExp')!;
    const cardCvv = this.form.get('paymentDetails.cardCvv')!;

    iban.clearValidators();
    cardNumber.clearValidators();
    cardHolder.clearValidators();
    cardExp.clearValidators();
    cardCvv.clearValidators();

    if (method !== 'bank_transfer') {
      iban.setValue('');
    }
    if (method !== 'card_mock') {
      cardNumber.setValue('');
      cardHolder.setValue('');
      cardExp.setValue('');
      cardCvv.setValue('');
    }

    if (method === 'bank_transfer') {
      iban.setValidators([
        Validators.required,
        Validators.pattern(/^[A-Z]{2}[0-9A-Z]{13,30}$/),
      ]);
    }

    if (method === 'card_mock') {
      cardNumber.setValidators([
        Validators.required,
        Validators.pattern(/^\d{16}$/),
      ]);

      cardHolder.setValidators([
        Validators.required,
        Validators.pattern(/^[A-Za-zΑ-Ωα-ωΆΈΉΊΌΎΏάέήίόύώ ]{2,}$/),
      ]);

      cardExp.setValidators([
        Validators.required,
        Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/),
      ]);

      cardCvv.setValidators([
        Validators.required,
        Validators.pattern(/^\d{3}$/),
      ]);
    }

    iban.updateValueAndValidity();
    cardNumber.updateValueAndValidity();
    cardHolder.updateValueAndValidity();
    cardExp.updateValueAndValidity();
    cardCvv.updateValueAndValidity();
  }

  private applyShippingValidators(): void {
    const method = this.form.get('shippingMethod')!.value as ShippingMethod;
    const city = this.form.get('shipping.city')!;
    const zip = this.form.get('shipping.zip')!;
    const address1 = this.form.get('shipping.address1')!;

    if (method === 'pickup') {
      city.clearValidators();
      zip.clearValidators();
      address1.clearValidators();
    } else {
      city.setValidators([Validators.required]);
      zip.setValidators([Validators.required]);
      address1.setValidators([Validators.required]);
    }

    city.updateValueAndValidity();
    zip.updateValueAndValidity();
    address1.updateValueAndValidity();
  }

  applyDiscount(): void {
    const code = this.discountCode.trim().toUpperCase();
    
    if (!code) {
      this.discountError = 'Εισάγετε κωδικό έκπτωσης';
      return;
    }

    this.applyingDiscount = true;
    this.discountError = '';

    this.discountService.validateDiscount(code, this.subtotal).subscribe({
      next: (res) => {
        if (res.success && res.discount) {
          this.appliedDiscount = res.discount;
          this.discountAmount = res.discount.amount;
          this.discountCode = res.discount.code;
          
          let message = `Κωδικός "${res.discount.code}" εφαρμόστηκε!`;
          if (res.discount.type === 'percentage') {
            message += ` (-${res.discount.value}%)`;
          }
          this.toastService.success(message);
          
        } else {
          this.discountError = res.message || 'Μη έγκυρος κωδικός';
        }
        this.applyingDiscount = false;
      },
      error: (err) => {
        this.discountError = err.error?.message || 'Σφάλμα επικύρωσης κωδικού';
        this.applyingDiscount = false;
      }
    });
  }

  removeDiscount(): void {
    this.discountCode = '';
    this.discountAmount = 0;
    this.appliedDiscount = null;
    this.discountError = '';
    this.toastService.info('Ο κωδικός έκπτωσης αφαιρέθηκε');
  }

  submit(): void {
    this.error = null;
    this.success = null;

    if (this.items.length === 0) {
      this.error = 'Το καλάθι είναι άδειο.';
      return;
    }

    const cardNumCtrl = this.form.get('paymentDetails.cardNumber');
    if (cardNumCtrl?.value) {
      cardNumCtrl.setValue(String(cardNumCtrl.value).replace(/\s+/g, ''));
    }
    const ibanCtrl = this.form.get('paymentDetails.iban');
    if (ibanCtrl?.value) {
      ibanCtrl.setValue(String(ibanCtrl.value).replace(/\s+/g, '').toUpperCase());
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error = 'Διόρθωσε τα λάθη στη φόρμα.';
      return;
    }

    const v = this.form.value as any;
    const details = v.paymentDetails || {};

    const payload: CreateOrderDto = {
      items: this.items.map((i) => ({
        productId: Number(i.productId),
        quantity: Number(i.quantity),
        unitPrice: Number(i.price),
      })),

      recipientName: String(v.recipientName).trim(),
      phone: String(v.phone).trim(),

      shipping: {
        country: String(v.shipping?.country || 'ΕΛΛΑΔΑ'),
        city: String(v.shipping?.city || '').trim(),
        zip: String(v.shipping?.zip || '').trim(),
        address1: String(v.shipping?.address1 || '').trim(),
        floor: String(v.shipping?.floor || '').trim() || undefined,
        notes: String(v.shipping?.notes || '').trim() || undefined,
      },

      shippingMethod: v.shippingMethod as ShippingMethod,
      paymentMethod: v.paymentMethod as PaymentMethod,

      paymentIban: v.paymentMethod === 'bank_transfer'
        ? String(details.iban || '').trim()
        : undefined,

      card: v.paymentMethod === 'card_mock'
        ? {
            number: String(details.cardNumber || '').trim(),
            holder: String(details.cardHolder || '').trim(),
            exp: String(details.cardExp || '').trim(),
            cvv: String(details.cardCvv || '').trim(),
          }
        : undefined,
      
      discountCode: this.appliedDiscount?.code || undefined,
      discountAmount: this.discountAmount || 0
    };

    this.isSubmitting = true;

    this.orders.createOrder(payload).subscribe({
      next: (res) => {
        if (res.success) {
          const id = res.orderId!;
          this.success = `Η παραγγελία δημιουργήθηκε (Order #${id}).`;
          this.toastService.success('Η παραγγελία ολοκληρώθηκε! 🎉');
          this.cart.clear();

          setTimeout(() => {
            this.isSubmitting = false;
            this.router.navigate(['/profile/orders', id]);
          }, 600);
        } else {
          this.error = res.message || 'Αποτυχία δημιουργίας παραγγελίας.';
          this.isSubmitting = false;
        }
      },
      error: (err) => {
        const message = err?.error?.message || 'Σφάλμα επικοινωνίας με τον server.';
        this.error = message;
        this.toastService.error(message);
        this.isSubmitting = false;
      },
    });
  }
}