import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ProductDto, ProductService } from './product.service';

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

  constructor(private productService: ProductService) {}

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

  remove(productId: number): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.getAll().filter(p => p.id !== productId)));
    } catch {}
  }

  getRecent(excludeId?: number): RecentlyViewedProduct[] {
    return this.getAll().filter(p => p.id !== excludeId);
  }

  refreshRecent(excludeId?: number): Observable<RecentlyViewedProduct[]> {
    const recent = this.getRecent(excludeId);
    if (recent.length === 0) return of([]);

    return forkJoin(recent.map(item => this.productService.getProduct(item.id).pipe(
      map(res => ({ id: item.id, product: res.product as ProductDto | null })),
      catchError((err: { status?: number }) => of({ id: item.id, product: err?.status === 404 ? null : undefined }))
    ))).pipe(
      map(results => {
        const removedIds = new Set(results.filter(r => r.product === null).map(r => r.id));
        const freshById = new Map(results.filter(r => r.product).map(r => [r.id, r.product as ProductDto]));

        const updated = this.getAll()
          .filter(p => !removedIds.has(p.id))
          .map(p => {
            const fresh = freshById.get(p.id);
            return fresh ? { id: p.id, name: fresh.name, price: fresh.price, image_url: fresh.image_url } : p;
          });

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {}

        return updated.filter(p => p.id !== excludeId);
      })
    );
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
