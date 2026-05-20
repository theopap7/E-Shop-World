import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { BreadcrumbService, Breadcrumb } from '../breadcrumb.service';
 
@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './breadcrumb.html',
  styleUrl: './breadcrumb.css'
})
export class BreadcrumbComponent implements OnInit, OnDestroy {
 
  breadcrumbs: Breadcrumb[] = [];
  showBreadcrumbs = true;
 
  private sub?: Subscription;
  private routerSub?: Subscription;
 
  constructor(
    private breadcrumbService: BreadcrumbService,
    private router: Router
  ) {}
 
  ngOnInit(): void {
    // Hide breadcrumbs on specific pages
    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        const url = this.router.url;
        
        // Hide on: login, register, 404
        this.showBreadcrumbs = 
          !url.includes('/login') && 
          !url.includes('/register') &&
          !url.includes('/404');
      });
 
    // Subscribe to breadcrumb changes
    this.sub = this.breadcrumbService.breadcrumbs$.subscribe(breadcrumbs => {
      this.breadcrumbs = breadcrumbs;
    });
  }
 
  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }
}
 