import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { BreadcrumbService, Breadcrumb } from '../services/breadcrumb.service';

// Standalone auth/error pages that never show a breadcrumb bar. "**" is the
// wildcard route (any unmatched URL), not the literal string "404" in the
// URL — matching on route config instead of the URL string catches that.
const HIDDEN_ROUTE_PATHS = new Set(['login', 'register', 'forgot-password', 'reset-password', 'verify-email', '404', '**']);

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './breadcrumb.html',
  styleUrl: './breadcrumb.css'
})
export class BreadcrumbComponent implements OnInit {

  breadcrumbs: Breadcrumb[] = [];
  showBreadcrumbs = true;

  private destroyRef = inject(DestroyRef);

  constructor(
    private breadcrumbService: BreadcrumbService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const matchedPath = this.router.routerState.snapshot.root.firstChild?.routeConfig?.path;
        this.showBreadcrumbs = !matchedPath || !HIDDEN_ROUTE_PATHS.has(matchedPath);
      });

    this.breadcrumbService.breadcrumbs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(breadcrumbs => {
      this.breadcrumbs = breadcrumbs;
    });
  }
}
