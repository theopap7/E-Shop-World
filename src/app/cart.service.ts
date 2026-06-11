import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { ProductDto } from './product.service';
import { AuthService, AuthUser } from './auth.service';
import { ToastService } from './toast.service';  // ✅ ADD THIS

export interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  stock: number;
  image_url?: string;
}

const GUEST_KEY = 'ecom_cart_guest';
const USER_KEY_PREFIX = 'ecom_cart_user_';

@Injectable({ providedIn: 'root' })
export class CartService implements OnDestroy {
  private currentStorageKey = GUEST_KEY;

  private readonly itemsSubject = new BehaviorSubject<CartItem[]>([]);
  readonly items$ = this.itemsSubject.asObservable();
  private readonly sidebarSubject = new BehaviorSubject<boolean>(false);
  readonly isOpen$ = this.sidebarSubject.asObservable();

  openSidebar(): void {
    this.sidebarSubject.next(true);
  }

  closeSidebar(): void {
    this.sidebarSubject.next(false);
  }

  toggleSidebar(): void {
    this.sidebarSubject.next(!this.sidebarSubject.value);
  }

  private authSub: Subscription;

  // ✅ ADD toastService HERE
  constructor(
    private auth: AuthService,
    private toastService: ToastService  // ✅ ADD THIS
  ) {
    this.setStorageKeyFromUser(this.auth.getUser());
    this.itemsSubject.next(this.loadFromStorage(this.currentStorageKey));

    this.authSub = this.auth.user$.subscribe((user) => {
      const prevKey = this.currentStorageKey;
      this.setStorageKeyFromUser(user);

      if (prevKey !== this.currentStorageKey) {
        const guestItems = prevKey === GUEST_KEY ? this.loadFromStorage(GUEST_KEY) : [];
        const userItems = this.loadFromStorage(this.currentStorageKey);

        if (guestItems.length > 0 && user) {
          const merged = [...userItems];
          for (const guestItem of guestItems) {
            const existing = merged.find(i => i.productId === guestItem.productId);
            if (existing) {
              existing.quantity = Math.min(existing.quantity + guestItem.quantity, existing.stock);
            } else {
              merged.push(guestItem);
            }
          }
          localStorage.removeItem(GUEST_KEY);
          this.setItems(merged);
        } else {
          this.itemsSubject.next(userItems);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.authSub.unsubscribe();
  }

  getItems(): CartItem[] {
    return this.itemsSubject.value;
  }

  getTotal(): number {
    return this.itemsSubject.value.reduce((sum, i) => sum + i.price * i.quantity, 0);
  }

  getCount(): number {
    return this.itemsSubject.value.reduce((sum, i) => sum + i.quantity, 0);
  }

  // ✅ ADD TOAST HERE
  addToCart(product: ProductDto, qty = 1): void {
    const items = [...this.itemsSubject.value];
    const existing = items.find(i => i.productId === product.id);

    if (existing) {
      const canAdd = product.stock - existing.quantity;
      if (canAdd <= 0) {
        this.toastService.error(`Δεν υπάρχει μεγαλύτερη διαθεσιμότητα για "${product.name}"`);
        return;
      }
      existing.quantity = Math.min(existing.quantity + qty, product.stock);
    } else {
      items.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: Math.min(qty, product.stock),
        stock: product.stock,
        image_url: product.image_url,
      });
    }

    this.setItems(items);
    this.toastService.success(`${product.name} προστέθηκε στο καλάθι!`);
  }

  increase(productId: number): void {
    const items = [...this.itemsSubject.value];
    const item = items.find(i => i.productId === productId);
    if (!item) return;
    if (item.quantity >= item.stock) {
      this.toastService.error(`Δεν υπάρχει μεγαλύτερη διαθεσιμότητα`);
      return;
    }
    item.quantity += 1;
    this.setItems(items);
  }

  setQuantity(productId: number, qty: number): void {
    const items = [...this.itemsSubject.value];
    const item = items.find(i => i.productId === productId);
    if (!item) return;
    if (qty <= 0) {
      this.setItems(items.filter(i => i.productId !== productId));
      return;
    }
    item.quantity = Math.min(qty, item.stock);
    this.setItems(items);
  }

  decrease(productId: number): void {
    const items = [...this.itemsSubject.value];
    const idx = items.findIndex(i => i.productId === productId);
    if (idx === -1) return;

    items[idx].quantity -= 1;
    if (items[idx].quantity <= 0) items.splice(idx, 1);

    this.setItems(items);
  }

  // ✅ ADD TOAST HERE TOO
  removeFromCart(productId: number): void {
    const items = this.itemsSubject.value.filter(i => i.productId !== productId);
    this.setItems(items);
 
  }

  reorderItems(items: Array<{ id: number; name: string; price: number; stock: number; image_url?: string }>): void {
    const cart = [...this.itemsSubject.value];
    for (const item of items) {
      if (item.stock <= 0) continue;
      const existing = cart.find(i => i.productId === item.id);
      if (existing) {
        existing.stock = item.stock;
        existing.quantity = Math.min((existing.quantity || 1) + 1, item.stock);
      } else {
        cart.push({ productId: item.id, name: item.name, price: item.price, quantity: 1, stock: item.stock, image_url: item.image_url });
      }
    }
    this.setItems(cart);
    this.toastService.success('Τα προϊόντα προστέθηκαν στο καλάθι!');
    this.openSidebar();
  }

  clear(): void {
    this.setItems([]);
  }

  // ... rest stays the same
  private setItems(items: CartItem[]): void {
    this.itemsSubject.next(items);
    this.saveToStorage(this.currentStorageKey, items);
  }

  private setStorageKeyFromUser(user: AuthUser | null): void {
    this.currentStorageKey = user?.id ? `${USER_KEY_PREFIX}${user.id}` : GUEST_KEY;
  }

  private loadFromStorage(key: string): CartItem[] {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  }

  private saveToStorage(key: string, items: CartItem[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {}
  }
}