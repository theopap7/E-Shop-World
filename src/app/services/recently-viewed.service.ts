import { Injectable } from '@angular/core';
import { ProductDto } from './product.service';

export interface RecentlyViewedProduct {
  id: number;
  name: string;
  price: number;
  image_url: string;
}

const STORAGE_KEY = 'recently_viewed_products';
const MAX_ITEMS = 5;

@Injectable({
  providedIn: 'root'
})
export class RecentlyViewedService {

  track(product: ProductDto): void {
    try {
      const items = this.getAll().filter(p => p.id !== product.id);

      items.unshift({
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
    } catch {
      // localStorage unavailable — ignore
    }
  }

  getRecent(excludeId?: number): RecentlyViewedProduct[] {
    return this.getAll().filter(p => p.id !== excludeId);
  }

  private getAll(): RecentlyViewedProduct[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
