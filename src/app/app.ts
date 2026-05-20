import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CartSidebarComponent } from './cart-sidebar/cart-sidebar';
import { ToastContainerComponent } from './toast/toast'; 
import { BreadcrumbComponent } from './breadcrumb/breadcrumb';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ RouterModule, CartSidebarComponent, ToastContainerComponent,BreadcrumbComponent ],
  template: `
    <app-cart-sidebar></app-cart-sidebar>
    <app-toast-container></app-toast-container>
       <div class="breadcrumb-wrapper">
      <app-breadcrumb></app-breadcrumb>
    </div>
    
    <router-outlet></router-outlet>
  `,
   styles: [`
    .breadcrumb-wrapper {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }
  `]
})
export class AppComponent {}
