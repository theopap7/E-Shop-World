import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription, EMPTY, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { ProductDto } from './product.service';
import { ToastService } from './toast.service';
import { AuthService, AuthUser } from './auth.service';
import { environment } from '../../environments/environment';

const GUEST_KEY = 'ecom_wishlist_guest';

@Injectable({ providedIn: 'root' })
export class WishlistService implements OnDestroy {
  private readonly apiUrl = environment.apiUrl;
  private readonly itemsSubject = new BehaviorSubject<ProductDto[]>([]);
  readonly items$ = this.itemsSubject.asObservable();
  private readonly loadErrorSubject = new BehaviorSubject<boolean>(false);
  readonly loadError$ = this.loadErrorSubject.asObservable();

  private authSub: Subscription;
  private previousUser: AuthUser | null = null;

  constructor(
    private http: HttpClient,
    private toastService: ToastService,
    private auth: AuthService
  ) {
    this.previousUser = this.activeUser(this.auth.getUser());

    if (this.previousUser) {
      this.loadFromApi();
    } else {
      this.itemsSubject.next(this.loadGuestFromStorage());
    }

    this.authSub = this.auth.user$.subscribe(user => {
      const activeUser = this.activeUser(user);
      if (activeUser && !this.previousUser) {
        this.mergeGuestToApi();
      } else if (!activeUser && this.previousUser) {
        this.itemsSubject.next(this.loadGuestFromStorage());
      }
      this.previousUser = activeUser;
    });
  }

  private activeUser(user: AuthUser | null): AuthUser | null {
    return user && this.auth.isLoggedIn() ? user : null;
  }

  ngOnDestroy(): void {
    this.authSub.unsubscribe();
  }

  reload(): void {
    this.loadFromApi();
  }

  refreshGuestItems(): void {
    if (this.auth.isLoggedIn()) return;
    const ids = this.itemsSubject.value.map(p => p.id);
    if (ids.length === 0) return;

    const deletedIds = new Set<number>();

    forkJoin(ids.map(id =>
      this.http.get<{ success: boolean; product: ProductDto }>(`${this.apiUrl}/products/${id}`).pipe(
        map(res => res.product),
        catchError(err => {
          if (err?.status === 404) deletedIds.add(id);
          return of(null);
        })
      )
    )).subscribe(products => {
      if (this.auth.isLoggedIn()) return;
      const byId = new Map(products.filter((p): p is ProductDto => !!p).map(p => [p.id, p]));
      const items = this.itemsSubject.value
        .filter(p => !deletedIds.has(p.id))
        .map(p => byId.get(p.id) ?? p);
      this.setGuestItems(items);
    });
  }

  private loadFromApi(): void {
    this.loadErrorSubject.next(false);

    this.http
      .get<{ success: boolean; items: ProductDto[] }>(`${this.apiUrl}/wishlist`, { withCredentials: true })
      .pipe(catchError(() => {
        this.toastService.error('Αποτυχία φόρτωσης αγαπημένων');
        this.loadErrorSubject.next(true);
        return EMPTY;
      }))
      .subscribe(res => {
        if (res?.success) this.itemsSubject.next(res.items);
      });
  }

  private mergeGuestToApi(): void {
    const guestItems = this.loadGuestFromStorage();
    localStorage.removeItem(GUEST_KEY);

    if (guestItems.length === 0) {
      this.loadFromApi();
      return;
    }

    const requests = guestItems.map(item =>
      this.http
        .post<{ success: boolean }>(`${this.apiUrl}/wishlist/${item.id}`, {}, { withCredentials: true })
        .pipe(catchError(() => EMPTY))
    );

    forkJoin(requests).subscribe(() => this.loadFromApi());
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
    const isIn = this.isInWishlist(product.id);

    if (this.auth.isLoggedIn()) {
      if (isIn) {
        this.http
          .delete<{ success: boolean }>(`${this.apiUrl}/wishlist/${product.id}`, { withCredentials: true })
          .pipe(catchError(() => {
            this.toastService.error('Δεν ήταν δυνατή η αφαίρεση από τα αγαπημένα');
            return EMPTY;
          }))
          .subscribe(res => {
            if (res?.success) {
              this.itemsSubject.next(this.itemsSubject.value.filter(p => p.id !== product.id));
              this.toastService.info(`${product.name} αφαιρέθηκε από τα αγαπημένα`);
            }
          });
      } else {
        this.http
          .post<{ success: boolean }>(`${this.apiUrl}/wishlist/${product.id}`, {}, { withCredentials: true })
          .pipe(catchError(() => {
            this.toastService.error('Δεν ήταν δυνατή η προσθήκη στα αγαπημένα');
            return EMPTY;
          }))
          .subscribe(res => {
            if (res?.success) {
              this.itemsSubject.next([...this.itemsSubject.value, product]);
              this.toastService.success(`${product.name} προστέθηκε στα αγαπημένα! ❤️`);
            }
          });
      }
    } else {
      const items = [...this.itemsSubject.value];
      const index = items.findIndex(p => p.id === product.id);
      if (index === -1) {
        items.push(product);
        this.toastService.success(`${product.name} προστέθηκε στα αγαπημένα! ❤️`);
      } else {
        items.splice(index, 1);
        this.toastService.info(`${product.name} αφαιρέθηκε από τα αγαπημένα`);
      }
      this.setGuestItems(items);
    }
  }

  remove(productId: number): void {
    if (this.auth.isLoggedIn()) {
      this.http
        .delete<{ success: boolean }>(`${this.apiUrl}/wishlist/${productId}`, { withCredentials: true })
        .pipe(catchError(() => {
          this.toastService.error('Δεν ήταν δυνατή η αφαίρεση από τα αγαπημένα');
          return EMPTY;
        }))
        .subscribe(res => {
          if (res?.success) {
            this.itemsSubject.next(this.itemsSubject.value.filter(p => p.id !== productId));
            this.toastService.info('Προϊόν αφαιρέθηκε από τα αγαπημένα');
          }
        });
    } else {
      this.setGuestItems(this.itemsSubject.value.filter(p => p.id !== productId));
      this.toastService.info('Προϊόν αφαιρέθηκε από τα αγαπημένα');
    }
  }

  clear(): void {
    if (this.auth.isLoggedIn()) {
      this.http
        .delete<{ success: boolean }>(`${this.apiUrl}/wishlist`, { withCredentials: true })
        .pipe(catchError(() => {
          this.toastService.error('Δεν ήταν δυνατή η διαγραφή των αγαπημένων');
          return EMPTY;
        }))
        .subscribe(res => {
          if (res?.success) {
            this.itemsSubject.next([]);
            this.toastService.warning('Όλα τα αγαπημένα διαγράφηκαν');
          }
        });
    } else {
      this.setGuestItems([]);
      this.toastService.warning('Όλα τα αγαπημένα διαγράφηκαν');
    }
  }

  private loadGuestFromStorage(): ProductDto[] {
    try {
      const raw = localStorage.getItem(GUEST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private setGuestItems(items: ProductDto[]): void {
    this.itemsSubject.next(items);
    try {
      localStorage.setItem(GUEST_KEY, JSON.stringify(items));
    } catch {}
  }
}
