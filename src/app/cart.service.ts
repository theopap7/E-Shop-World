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
        const items = this.loadFromStorage(this.currentStorageKey);
        this.itemsSubject.next(items);
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
  addToCart(product: ProductDto): void {
    const items = [...this.itemsSubject.value];
    const existing = items.find(i => i.productId === product.id);

    if (existing) {
      if (existing.quantity >= product.stock) {
        this.toastService.error(`Δεν υπάρχει μεγαλύτερη διαθεσιμότητα για "${product.name}"`);
        return;
      }
      existing.quantity += 1;
    } else {
      items.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        stock: product.stock,
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