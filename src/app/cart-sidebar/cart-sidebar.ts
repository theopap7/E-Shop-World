import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
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
  private subs: Subscription[] = [];

  constructor(public cartService: CartService, private toastService: ToastService) {}

  ngOnInit(): void {
    // Subscribe στο isOpen$
    this.subs.push(
      this.cartService.isOpen$.subscribe(open => {
        this.isOpen = open;

        // Αν ανοίξει το sidebar → block scroll
        if (open) {
          document.body.style.overflow = 'hidden';
        } else {
          document.body.style.overflow = '';
        }
      })
    );

    // Subscribe στα items
    this.subs.push(
      this.cartService.items$.subscribe(items => {
        this.items = items;
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
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