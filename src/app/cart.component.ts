import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartService, CartItem } from './cart.service';
import { Router, RouterModule } from '@angular/router';
import { ImageUrlPipe } from './shared/image-url.pipe';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ImageUrlPipe],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css',
})
export class CartComponent implements OnInit {
  items: CartItem[] = [];
  total = 0;

  orderError: string | null = null;

  private destroyRef = inject(DestroyRef);

  constructor(
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cartService.items$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((items) => {
      this.items = items;
      this.total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    });
  }

  setQty(productId: number, qty: number, size?: string): void {
    this.cartService.setQuantity(productId, Number(qty), size);
  }

  qtyOptions(item: CartItem): number[] {
    return Array.from({ length: Math.min(item.stock, 100) }, (_, i) => i + 1);
  }

  increase(productId: number, size?: string): void {
    this.cartService.increase(productId, size);
  }

  decrease(productId: number, size?: string): void {
    this.cartService.decrease(productId, size);
  }

  remove(productId: number, size?: string): void {
    this.cartService.removeFromCart(productId, size);
  }

  clear(): void {
    this.cartService.clear();
  }

  goToCheckout(): void {
    this.orderError = null;

    if (this.items.length === 0) {
      this.orderError = 'Το καλάθι είναι άδειο.';
      return;
    }

    this.router.navigate(['/checkout']);
  }
}
