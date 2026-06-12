import { Component, OnInit, OnDestroy, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartService, CartItem } from '../cart.service';
import { ToastService } from '../toast.service';

@Component({
  selector: 'app-cart-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cart-sidebar.html',
  styleUrl: './cart-sidebar.css'
})
export class CartSidebarComponent implements OnInit, OnDestroy {

  isOpen = false;
  items: CartItem[] = [];

  private destroyRef = inject(DestroyRef);

  constructor(public cartService: CartService, private toastService: ToastService) {}

  ngOnInit(): void {
    this.cartService.isOpen$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(open => {
      this.isOpen = open;
      document.body.style.overflow = open ? 'hidden' : '';
    });

    this.cartService.items$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(items => {
      this.items = items;
    });
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  get total(): number {
    return this.cartService.getTotal();
  }

  close(): void {
    this.cartService.closeSidebar();
  }

  increase(productId: number, size?: string): void {
    this.cartService.increase(productId, size);
  }

  decrease(productId: number, size?: string): void {
    const item = this.cartService.getItems().find(i => i.productId === productId && (i.size ?? '') === (size ?? ''));
    if (!item) return;
    if (item.quantity === 1) {
      this.toastService.info(`${item.name} αφαιρέθηκε από το καλάθι`);
    }
    this.cartService.decrease(productId, size);
  }

  remove(productId: number, size?: string): void {
    const item = this.cartService.getItems().find(i => i.productId === productId && (i.size ?? '') === (size ?? ''));
    const productName = item?.name || 'Προϊόν';
    this.cartService.removeFromCart(productId, size);
    this.toastService.info(`${productName} αφαιρέθηκε από το καλάθι`);
  }

  clearCart(): void {
    if (!confirm('Θέλεις να αδειάσεις το καλάθι;')) return;
    this.cartService.clear();
    this.toastService.info('Το καλάθι αδειάστηκε');
  }
}
