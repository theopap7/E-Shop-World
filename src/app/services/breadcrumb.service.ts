import { Injectable } from '@angular/core';
import { Router, NavigationEnd, Route } from '@angular/router';
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

  constructor(private router: Router) {
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

  // Looks up the breadcrumb label declared on a route in app.routes.ts
  // (matching ":id"-style segments as wildcards) so labels live in one
  // place instead of being duplicated here.
  private routeLabel(url: string): string | undefined {
    const segments = url.split('/').filter(s => s);
    const match = this.router.config.find((route: Route) => {
      if (typeof route.path !== 'string') return false;
      const routeSegments = route.path.split('/').filter(s => s);
      if (routeSegments.length !== segments.length) return false;
      return routeSegments.every((seg, i) => seg.startsWith(':') || seg === segments[i]);
    });
    return match?.data?.['breadcrumb'] as string | undefined;
  }

  /**
   * Build breadcrumbs from URL path
   */
  private buildBreadcrumbsFromUrl(url: string): Breadcrumb[] {
    const breadcrumbs: Breadcrumb[] = [];

    // Always start with Home
    breadcrumbs.push({
      label: 'Αρχική',
      url: '/dashboard',
      active: false
    });

    const segments = url.split('/').filter(s => s);

    // Handle empty or dashboard
    if (segments.length === 0 || segments[0] === 'dashboard') {
      breadcrumbs[0].active = true;
      return breadcrumbs;
    }

    if (segments[0] === 'admin') {
      breadcrumbs.push({
        label: this.routeLabel('/admin') ?? 'Διαχείριση',
        url: '/admin',
        active: segments.length === 1
      });

      if (segments[1] === 'products') {
        breadcrumbs.push({
          label: this.routeLabel('/admin/products') ?? 'Προϊόντα',
          url: '/admin/products',
          active: segments.length === 2
        });

        if (segments[2] === 'new') {
          breadcrumbs.push({
            label: this.routeLabel('/admin/products/new') ?? 'Νέο Προϊόν',
            url: '/admin/products/new',
            active: true
          });
        } else if (segments[2] === 'edit' && segments[3]) {
          breadcrumbs.push({
            label: this.routeLabel(`/admin/products/edit/${segments[3]}`) ?? 'Επεξεργασία',
            url: `/admin/products/edit/${segments[3]}`,
            active: true
          });
        }
      } else if (segments[1] === 'orders') {
        breadcrumbs.push({
          label: this.routeLabel('/admin/orders') ?? 'Παραγγελίες',
          url: '/admin/orders',
          active: segments.length === 2
        });

        if (segments[2]) {
          // shows the actual order number, not the generic route label
          breadcrumbs.push({
            label: `Παραγγελία #${segments[2]}`,
            url: `/admin/orders/${segments[2]}`,
            active: true
          });
        }
      } else if (segments[1]) {
        // any other admin leaf (reviews, discounts, returns, users, ...) —
        // sourced straight from its route so a new one never needs a branch here
        const path = `/admin/${segments[1]}`;
        const label = this.routeLabel(path);
        if (label) {
          breadcrumbs.push({ label, url: path, active: true });
        }
      }

      return breadcrumbs;
    }

    if (segments[0] === 'profile') {
      breadcrumbs.push({
        label: this.routeLabel('/profile') ?? 'Προφίλ',
        url: '/profile',
        active: segments.length === 1
      });

      if (segments[1] === 'orders') {
        breadcrumbs.push({
          label: this.routeLabel('/profile/orders') ?? 'Παραγγελίες',
          url: '/profile/orders',
          active: segments.length === 2
        });

        if (segments[2]) {
          // shows the actual order number, not the generic route label
          breadcrumbs.push({
            label: `Παραγγελία #${segments[2]}`,
            url: `/profile/orders/${segments[2]}`,
            active: true
          });
        }
      } else if (segments[1]) {
        // any other profile leaf (reviews, returns, ...) — sourced straight
        // from its route so a new one never needs a branch here
        const path = `/profile/${segments[1]}`;
        const label = this.routeLabel(path);
        if (label) {
          breadcrumbs.push({ label, url: path, active: true });
        }
      }

      return breadcrumbs;
    }

    if (segments[0] === 'cart') {
      breadcrumbs.push({
        label: this.routeLabel('/cart') ?? 'Καλάθι',
        url: '/cart',
        active: true
      });
      return breadcrumbs;
    }

    if (segments[0] === 'checkout') {
      breadcrumbs.push({
        label: this.routeLabel('/cart') ?? 'Καλάθι',
        url: '/cart',
        active: false
      });
      breadcrumbs.push({
        label: this.routeLabel('/checkout') ?? 'Ολοκλήρωση',
        url: '/checkout',
        active: true
      });
      return breadcrumbs;
    }

    if (segments[0] === 'wishlist') {
      breadcrumbs.push({
        label: this.routeLabel('/wishlist') ?? 'Αγαπημένα',
        url: '/wishlist',
        active: true
      });
      return breadcrumbs;
    }

    if (segments[0] === 'products' && segments[1]) {
      breadcrumbs.push({
        label: this.routeLabel('/dashboard') ?? 'Προϊόντα',
        url: '/dashboard',
        active: false
      });
      breadcrumbs.push({
        label: this.routeLabel(`/products/${segments[1]}`) ?? 'Προϊόν',
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
