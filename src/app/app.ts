import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CartSidebarComponent } from './cart-sidebar/cart-sidebar';
import { ToastContainerComponent } from './toast/toast';
import { BreadcrumbComponent } from './breadcrumb/breadcrumb';
import { HeaderComponent } from './header/header';
import { FooterComponent } from './footer/footer';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ RouterModule, CartSidebarComponent, ToastContainerComponent, BreadcrumbComponent, HeaderComponent, FooterComponent ],
  template: `
    <app-cart-sidebar></app-cart-sidebar>
    <app-toast-container></app-toast-container>
    <div class="layout-wrapper">
      <app-header></app-header>
      <app-breadcrumb></app-breadcrumb>
      <router-outlet></router-outlet>
    </div>
    <app-footer></app-footer>
  `,
   styles: [`
    .layout-wrapper {
      max-width: 1200px;
      margin: 0 auto;
      padding: 12px 20px 0;
    }
  `]
})
export class AppComponent {}
