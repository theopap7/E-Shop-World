import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CartSidebarComponent } from './cart-sidebar/cart-sidebar';
import { ToastContainerComponent } from './toast/toast';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog';
import { BreadcrumbComponent } from './breadcrumb/breadcrumb';
import { HeaderComponent } from './header/header';
import { FooterComponent } from './footer/footer';
import { EmailVerifyBannerComponent } from './email-verify-banner/email-verify-banner';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ RouterModule, CartSidebarComponent, ToastContainerComponent, ConfirmDialogComponent, BreadcrumbComponent, HeaderComponent, FooterComponent, EmailVerifyBannerComponent ],
  template: `
    <app-cart-sidebar></app-cart-sidebar>
    <app-toast-container></app-toast-container>
    <app-confirm-dialog></app-confirm-dialog>
    <div class="app-shell">
      <app-email-verify-banner></app-email-verify-banner>
      <div class="layout-wrapper">
        <app-header></app-header>
        <app-breadcrumb></app-breadcrumb>
        <router-outlet></router-outlet>
      </div>
      <app-footer></app-footer>
    </div>
  `,
   styles: [`
    .app-shell {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .layout-wrapper {
      flex: 1;
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      padding: 12px 20px 0;
    }
  `]
})
export class AppComponent {}
