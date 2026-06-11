import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CartService, CartItem } from './cart.service';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css',
})
export class CartComponent implements OnInit, OnDestroy {
  items: CartItem[] = [];
  total = 0;

  orderError: string | null = null;

  private sub?: Subscription;

  constructor(
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.sub = this.cartService.items$.subscribe((items) => {
      this.items = items;
      this.total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
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
