import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ProductDto, ProductService } from './product.service';
import { AuthService, AuthUser } from './auth.service';
import { ToastService } from './toast.service';

export interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  stock: number;
  image_url?: string;
  size?: string;
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
    this.refreshFromServer();
  }

  closeSidebar(): void {
    this.sidebarSubject.next(false);
  }

  toggleSidebar(): void {
    if (this.sidebarSubject.value) {
      this.closeSidebar();
    } else {
      this.openSidebar();
    }
  }

  private authSub: Subscription;

  constructor(
    private auth: AuthService,
    private toastService: ToastService,
    private productService: ProductService
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
            const existing = merged.find(i => i.productId === guestItem.productId && (i.size ?? '') === (guestItem.size ?? ''));
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

  addToCart(product: ProductDto, qty = 1, size?: string): boolean {
    const availableStock = size ? (product.sizeStock?.[size] ?? 0) : product.stock;

    const items = [...this.itemsSubject.value];
    const existing = items.find(i => i.productId === product.id && (i.size ?? '') === (size ?? ''));

    if (existing) {
      const canAdd = availableStock - existing.quantity;
      if (canAdd <= 0) {
        this.toastService.error(`Δεν υπάρχει μεγαλύτερη διαθεσιμότητα για "${product.name}"`);
        return false;
      }
      existing.quantity = Math.min(existing.quantity + qty, availableStock);
    } else {
      items.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: Math.min(qty, availableStock),
        stock: availableStock,
        image_url: product.image_url,
        size,
      });
    }

    this.setItems(items);
    this.toastService.success(`${product.name}${size ? ` (${size})` : ''} προστέθηκε στο καλάθι!`);
    return true;
  }

  increase(productId: number, size?: string): void {
    const items = [...this.itemsSubject.value];
    const item = items.find(i => i.productId === productId && (i.size ?? '') === (size ?? ''));
    if (!item) return;
    if (item.quantity >= item.stock) {
      this.toastService.error(`Δεν υπάρχει μεγαλύτερη διαθεσιμότητα`);
      return;
    }
    item.quantity += 1;
    this.setItems(items);
  }

  setQuantity(productId: number, qty: number, size?: string): void {
    const items = [...this.itemsSubject.value];
    const item = items.find(i => i.productId === productId && (i.size ?? '') === (size ?? ''));
    if (!item) return;
    if (qty <= 0) {
      this.setItems(items.filter(i => !(i.productId === productId && (i.size ?? '') === (size ?? ''))));
      return;
    }
    item.quantity = Math.min(qty, item.stock);
    this.setItems(items);
  }

  decrease(productId: number, size?: string): void {
    const items = [...this.itemsSubject.value];
    const idx = items.findIndex(i => i.productId === productId && (i.size ?? '') === (size ?? ''));
    if (idx === -1) return;

    items[idx].quantity -= 1;
    if (items[idx].quantity <= 0) items.splice(idx, 1);

    this.setItems(items);
  }

  removeFromCart(productId: number, size?: string): void {
    const items = this.itemsSubject.value.filter(i => !(i.productId === productId && (i.size ?? '') === (size ?? '')));
    this.setItems(items);
  }

  reorderItems(items: Array<{ id: number; name: string; price: number; quantity?: number; stock: number; image_url?: string; size?: string }>): void {
    const cart = [...this.itemsSubject.value];
    let addedCount = 0;
    for (const item of items) {
      if (item.stock <= 0) continue;
      addedCount++;
      const qty = item.quantity ?? 1;
      const existing = cart.find(i => i.productId === item.id && (i.size ?? '') === (item.size ?? ''));
      if (existing) {
        existing.stock = item.stock;
        existing.quantity = Math.min(existing.quantity + qty, item.stock);
      } else {
        cart.push({ productId: item.id, name: item.name, price: item.price, quantity: Math.min(qty, item.stock), stock: item.stock, image_url: item.image_url, size: item.size });
      }
    }

    if (addedCount === 0) {
      this.toastService.error('Τα προϊόντα αυτής της παραγγελίας δεν είναι πλέον διαθέσιμα');
      return;
    }

    this.setItems(cart);
    this.toastService.success('Τα προϊόντα προστέθηκαν στο καλάθι!');
    this.openSidebar();
  }

  refreshFromServer(): void {
    const ids = [...new Set(this.itemsSubject.value.map(i => i.productId))];
    if (ids.length === 0) return;

    forkJoin(ids.map(id => this.productService.getProduct(id).pipe(
      map(res => res.product),
      catchError(() => of(null))
    ))).subscribe(products => {
      const byId = new Map(products.filter((p): p is ProductDto => !!p).map(p => [p.id, p]));
      let priceChanged = false;

      const items = this.itemsSubject.value.map(item => {
        const product = byId.get(item.productId);
        if (!product) return item;

        const price = Number(product.price);
        if (price !== Number(item.price)) priceChanged = true;

        const stock = item.size ? (product.sizeStock?.[item.size] ?? 0) : product.stock;
        const quantity = stock > 0 ? Math.min(item.quantity, stock) : item.quantity;
        return { ...item, name: product.name, price, image_url: product.image_url, stock, quantity };
      });

      this.setItems(items);
      if (priceChanged) {
        this.toastService.info('Οι τιμές στο καλάθι ενημερώθηκαν με τις τρέχουσες');
      }
    });
  }

  clear(): void {
    this.setItems([]);
  }

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