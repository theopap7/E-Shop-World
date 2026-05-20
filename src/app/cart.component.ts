import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { CartService, CartItem } from './cart.service';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterModule],
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

  increase(productId: number): void {
    this.cartService.increase(productId);
  }

  decrease(productId: number): void {
    this.cartService.decrease(productId);
  }

  remove(productId: number): void {
    this.cartService.removeFromCart(productId);
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
