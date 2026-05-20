import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ProductDto } from './product.service';
import { ToastService } from './toast.service';  // ✅ ADD

const WISHLIST_KEY = 'ecom_wishlist';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  
  private readonly itemsSubject = new BehaviorSubject<ProductDto[]>([]);
  readonly items$ = this.itemsSubject.asObservable();

  // ✅ INJECT ToastService
  constructor(private toastService: ToastService) {
    this.itemsSubject.next(this.loadFromStorage());
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
      // Add to wishlist
      items.push(product);
      // ✅ Toast: Added
      this.toastService.success(`${product.name} προστέθηκε στα αγαπημένα! ❤️`);
    } else {
      // Remove from wishlist
      items.splice(index, 1);
      // ✅ Toast: Removed
      this.toastService.info(`${product.name} αφαιρέθηκε από τα αγαπημένα`);
    }

    this.setItems(items);
  }

  remove(productId: number): void {
    const items = this.itemsSubject.value.filter(p => p.id !== productId);
    this.setItems(items);
    // ✅ Toast: Removed (no product name available here)
    this.toastService.info('Προϊόν αφαιρέθηκε από τα αγαπημένα');
  }

  clear(): void {
    this.setItems([]);
    // ✅ Toast: Cleared all
    this.toastService.warning('Όλα τα αγαπημένα διαγράφηκαν');
  }

  // Private helpers
  private setItems(items: ProductDto[]): void {
    this.itemsSubject.next(items);
    this.saveToStorage(items);
  }

  private loadFromStorage(): ProductDto[] {
    try {
      const raw = localStorage.getItem(WISHLIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveToStorage(items: ProductDto[]): void {
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save wishlist:', e);
    }
  }
}