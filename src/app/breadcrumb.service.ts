import { Injectable } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter, distinctUntilChanged } from 'rxjs/operators';
 
export interface Breadcrumb {
  label: string;
  url: string;
  active: boolean;
}
 
@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private readonly breadcrumbsSubject = new BehaviorSubject<Breadcrumb[]>([]);
  readonly breadcrumbs$: Observable<Breadcrumb[]> = this.breadcrumbsSubject.asObservable();
 
  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        distinctUntilChanged()
      )
      .subscribe(() => {
        const breadcrumbs = this.buildBreadcrumbsFromUrl(this.router.url);
        this.breadcrumbsSubject.next(breadcrumbs);
      });
  }
 
  /**
   * Update the last breadcrumb label (for dynamic product names)
   */
  updateLastBreadcrumb(label: string): void {
    const current = this.breadcrumbsSubject.value;
    if (current.length === 0) return;
 
    const updated = current.map((b, i) =>
      i === current.length - 1 ? { ...b, label } : b
    );
 
    this.breadcrumbsSubject.next(updated);
  }
 
  /**
   * Build breadcrumbs from URL path
   */
  private buildBreadcrumbsFromUrl(url: string): Breadcrumb[] {
    const breadcrumbs: Breadcrumb[] = [];
 
    // Always start with Home
    breadcrumbs.push({
      label: 'Home',
      url: '/dashboard',
      active: false
    });
 
    const segments = url.split('/').filter(s => s);
 
    // Handle empty or dashboard
    if (segments.length === 0 || segments[0] === 'dashboard') {
      breadcrumbs[0].active = true;
      return breadcrumbs;
    }
 
    // ===== ADMIN ROUTES =====
    if (segments[0] === 'admin') {
      breadcrumbs.push({
        label: 'Διαχείριση',
        url: '/admin',
        active: segments.length === 1
      });
 
      if (segments[1] === 'products') {
        breadcrumbs.push({
          label: 'Προϊόντα',
          url: '/admin/products',
          active: segments.length === 2
        });
 
        if (segments[2] === 'new') {
          breadcrumbs.push({
            label: 'Νέο Προϊόν',
            url: '/admin/products/new',
            active: true
          });
        } else if (segments[2] === 'edit' && segments[3]) {
          breadcrumbs.push({
            label: 'Επεξεργασία',
            url: `/admin/products/edit/${segments[3]}`,
            active: true
          });
        }
      } else if (segments[1] === 'orders') {
        breadcrumbs.push({
          label: 'Παραγγελίες',
          url: '/admin/orders',
          active: segments.length === 2
        });
 
        if (segments[2]) {
          breadcrumbs.push({
            label: `Παραγγελία #${segments[2]}`,
            url: `/admin/orders/${segments[2]}`,
            active: true
          });
        }
      } else if (segments[1] === 'reviews') {
        breadcrumbs.push({
          label: 'Κριτικές',
          url: '/admin/reviews',
          active: true
        });
      } else if (segments[1] === 'discounts') {
        breadcrumbs.push({
          label: 'Κωδικοί Έκπτωσης',
          url: '/admin/discounts',
          active: true
        });
      }
 
      return breadcrumbs;
    }
 
    // ===== PROFILE ROUTES =====
    if (segments[0] === 'profile') {
      breadcrumbs.push({
        label: 'Προφίλ',
        url: '/profile',
        active: segments.length === 1
      });
 
      if (segments[1] === 'orders') {
        breadcrumbs.push({
          label: 'Παραγγελίες',
          url: '/profile/orders',
          active: segments.length === 2
        });
 
        if (segments[2]) {
          breadcrumbs.push({
            label: `Παραγγελία #${segments[2]}`,
            url: `/profile/orders/${segments[2]}`,
            active: true
          });
        }
      } else if (segments[1] === 'reviews') {
        breadcrumbs.push({
          label: 'Οι Κριτικές μου',
          url: '/profile/reviews',
          active: true
        });
      }
 
      return breadcrumbs;
    }
 
    // ===== CART & CHECKOUT =====
    if (segments[0] === 'cart') {
      breadcrumbs.push({
        label: 'Καλάθι',
        url: '/cart',
        active: true
      });
      return breadcrumbs;
    }
 
    if (segments[0] === 'checkout') {
      breadcrumbs.push({
        label: 'Καλάθι',
        url: '/cart',
        active: false
      });
      breadcrumbs.push({
        label: 'Ολοκλήρωση',
        url: '/checkout',
        active: true
      });
      return breadcrumbs;
    }
 
    // ===== WISHLIST =====
    if (segments[0] === 'wishlist') {
      breadcrumbs.push({
        label: 'Αγαπημένα',
        url: '/wishlist',
        active: true
      });
      return breadcrumbs;
    }
 
    // ===== PRODUCT DETAILS =====
    if (segments[0] === 'products' && segments[1]) {
      breadcrumbs.push({
        label: 'Προϊόντα',
        url: '/dashboard',
        active: false
      });
      breadcrumbs.push({
        label: 'Προϊόν',
        url: `/products/${segments[1]}`,
        active: true
      });
      return breadcrumbs;
    }
 
    // Fallback: mark home as active
    breadcrumbs[0].active = true;
    return breadcrumbs;
  }
}