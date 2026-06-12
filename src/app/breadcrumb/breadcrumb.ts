import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { BreadcrumbService, Breadcrumb } from '../breadcrumb.service';

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
        const url = this.router.url;
        this.showBreadcrumbs =
          !url.includes('/login') &&
          !url.includes('/register') &&
          !url.includes('/404');
      });

    this.breadcrumbService.breadcrumbs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(breadcrumbs => {
      this.breadcrumbs = breadcrumbs;
    });
  }
}
