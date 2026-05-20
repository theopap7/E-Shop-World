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

  increase(productId: number): void {
    this.cartService.increase(productId);
  }

 decrease(productId: number): void {
  // Get item BEFORE decreasing
  const item = this.cartService.getItems().find(i => i.productId === productId);
  
  if (!item) return;
  
  // ✅ Toast ΜΟΝΟ αν θα διαγραφεί (quantity = 1)
  if (item.quantity === 1) {
    this.toastService.info(`${item.name} αφαιρέθηκε από το καλάθι`);
  }
  // Αν quantity > 1 → Δεν εμφανίζουμε τίποτα
  
  this.cartService.decrease(productId);
}

  // ✅ UPDATE αυτό το method:
  remove(productId: number): void {
    // Get product name BEFORE removing
    const item = this.cartService.getItems().find(i => i.productId === productId);
    const productName = item?.name || 'Προϊόν';
    
    this.cartService.removeFromCart(productId);
    
    this.toastService.info(`${productName} αφαιρέθηκε από το καλάθι`);
  }
}