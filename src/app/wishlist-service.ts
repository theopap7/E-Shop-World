import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { ProductDto } from './product.service';
import { ToastService } from './toast.service';
import { AuthService, AuthUser } from './auth.service';

const GUEST_KEY = 'ecom_wishlist_guest';
const USER_KEY_PREFIX = 'ecom_wishlist_user_';

@Injectable({ providedIn: 'root' })
export class WishlistService implements OnDestroy {

  private readonly itemsSubject = new BehaviorSubject<ProductDto[]>([]);
  readonly items$ = this.itemsSubject.asObservable();

  private currentStorageKey = GUEST_KEY;
  private authSub: Subscription;

  constructor(private toastService: ToastService, private auth: AuthService) {
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
            if (!merged.some(i => i.id === guestItem.id)) {
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

  private setStorageKeyFromUser(user: AuthUser | null): void {
    this.currentStorageKey = user?.id ? `${USER_KEY_PREFIX}${user.id}` : GUEST_KEY;
  }

  getItems(): ProductDto[] {
    return this.itemsSubject.value;
  }

  getCount(): number {
    return this.itemsSubject.value.length;
  }

  isInWishlist(productId: number): boolean {
    return this.itemsSubject.value.some(p => p.id === productId);
  }

  toggle(product: ProductDto): void {
    const items = [...this.itemsSubject.value];
    const index = items.findIndex(p => p.id === product.id);

    if (index === -1) {
      items.push(product);
      this.toastService.success(`${product.name} προστέθηκε στα αγαπημένα! ❤️`);
    } else {
      items.splice(index, 1);
      this.toastService.info(`${product.name} αφαιρέθηκε από τα αγαπημένα`);
    }

    this.setItems(items);
  }

  remove(productId: number): void {
    const items = this.itemsSubject.value.filter(p => p.id !== productId);
    this.setItems(items);
    this.toastService.info('Προϊόν αφαιρέθηκε από τα αγαπημένα');
  }

  clear(): void {
    this.setItems([]);
    this.toastService.warning('Όλα τα αγαπημένα διαγράφηκαν');
  }

  private setItems(items: ProductDto[]): void {
    this.itemsSubject.next(items);
    this.saveToStorage(items);
  }

  private loadFromStorage(key: string): ProductDto[] {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveToStorage(items: ProductDto[]): void {
    try {
      localStorage.setItem(this.currentStorageKey, JSON.stringify(items));
    } catch {}
}
}