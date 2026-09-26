import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { WishlistService } from './wishlist.service';
import { AuthService, AuthUser } from './auth.service';
import { ToastService } from './toast.service';

describe('WishlistService', () => {
  const user = { id: 40, firstName: 'Test', lastName: 'User', email: 'test@example.com' } as AuthUser;
  let user$: BehaviorSubject<AuthUser | null>;
  let loggedIn: boolean;
  let http: HttpTestingController;

  function createService(): WishlistService {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        WishlistService,
        { provide: AuthService, useValue: { getUser: () => user$.value, isLoggedIn: () => loggedIn, user$: user$.asObservable() } },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['error', 'success', 'info', 'warning']) },
      ],
    });
    const service = TestBed.inject(WishlistService);
    http = TestBed.inject(HttpTestingController);
    return service;
  }

  beforeEach(() => localStorage.removeItem('ecom_wishlist_guest'));

  it('loads the wishlist once when the session is already active', () => {
    user$ = new BehaviorSubject<AuthUser | null>(user);
    loggedIn = true;

    createService();

    expect(http.match(r => r.url.endsWith('/wishlist')).length).toBe(1);
  });

  it('loads the wishlist after logging in again from an expired session', () => {
    user$ = new BehaviorSubject<AuthUser | null>(user);
    loggedIn = false;
    const service = createService();
    http.expectNone(r => r.url.endsWith('/wishlist'));

    loggedIn = true;
    user$.next({ ...user });

    const req = http.expectOne(r => r.url.endsWith('/wishlist'));
    req.flush({ success: true, items: [{ id: 1 }, { id: 2 }] });
    expect(service.getCount()).toBe(2);
  });
  it('refreshes a guest wishlist with current prices and drops deleted products', () => {
    localStorage.setItem('ecom_wishlist_guest', JSON.stringify([
      { id: 1, name: 'Old', price: 10, stock: 5 },
      { id: 2, name: 'Gone', price: 20, stock: 5 },
      { id: 3, name: 'Offline', price: 30, stock: 5 },
    ]));
    user$ = new BehaviorSubject<AuthUser | null>(null);
    loggedIn = false;
    const service = createService();

    service.refreshGuestItems();

    http.expectOne(r => r.url.endsWith('/products/1')).flush({ success: true, product: { id: 1, name: 'Old', price: 15, stock: 0 } });
    http.expectOne(r => r.url.endsWith('/products/2')).flush({ success: false }, { status: 404, statusText: 'Not Found' });
    http.expectOne(r => r.url.endsWith('/products/3')).error(new ProgressEvent('error'));

    const items = service.getItems();
    expect(items.map(p => p.id)).toEqual([1, 3]);
    expect(items[0].price).toBe(15);
    expect(items[0].stock).toBe(0);
    expect(JSON.parse(localStorage.getItem('ecom_wishlist_guest')!).length).toBe(2);
  });

  it('does not refresh from product pages when logged in', () => {
    user$ = new BehaviorSubject<AuthUser | null>(user);
    loggedIn = true;
    const service = createService();

    service.refreshGuestItems();

    http.expectNone(r => r.url.includes('/products/'));
  });
});
