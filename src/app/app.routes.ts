import { Routes } from '@angular/router';
import { RegisterComponent } from './register/register';
import { LoginComponent } from './login/login';
import { Dashboard } from './dashboard/dashboard';
import { CartComponent } from './cart.component';
import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';
import { ProfileComponent } from './profile.component';
import { MyOrdersComponent } from './my-orders/my-orders';
import { OrderDetailsComponent } from './order-details/order-details';
import { MyReviewsComponent } from './my-reviews/my-reviews';
import { CheckoutComponent } from './checkout/checkout';
import { WishlistComponent } from './wishlist/wishlist';
import { AdminDashboardComponent } from './admin/admin-dashboard';
import { AdminProductsComponent } from './admin/admin-products';
import { ProductFormComponent } from './admin/product-form';
import { AdminOrdersComponent } from './admin/admin-orders';
import { AdminReviewsComponent } from './admin/admin-reviews';
import { ProductDetailComponent } from './product-details/product-details';
import { NotFoundComponent } from './not-found/not-found';
import { AdminDiscountsComponent } from './admin-discounts/admin-discounts';
import { AdminReturnsComponent } from './admin/admin-returns';

export const routes: Routes = [

  // ===== AUTH (no breadcrumbs) =====
  { 
    path: 'register', 
    component: RegisterComponent 
  },
  { 
    path: 'login', 
    component: LoginComponent 
  },

  // ===== REDIRECT ROOT =====
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },

  // ===== MAIN ROUTES =====
  {
    path: 'dashboard',
    component: Dashboard,
    canActivate: [authGuard],
    data: { breadcrumb: 'Προϊόντα' }
  },

  { 
    path: 'cart', 
    component: CartComponent,
    data: { breadcrumb: 'Καλάθι' }
  },

  {
    path: 'products/:id',
    component: ProductDetailComponent,
    data: { breadcrumb: 'Προϊόν' }
  },

  {
    path: 'checkout',
    component: CheckoutComponent,
    canActivate: [authGuard],
    data: { breadcrumb: 'Ολοκλήρωση' }
  },

  {
    path: 'wishlist',
    component: WishlistComponent,
    data: { breadcrumb: 'Αγαπημένα' }
  },

  // ===== PROFILE =====
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [authGuard],
    data: { breadcrumb: 'Προφίλ' }
  },

  {
    path: 'profile/orders',
    component: MyOrdersComponent,
    canActivate: [authGuard],
    data: { breadcrumb: 'Παραγγελίες' }
  },

  {
    path: 'profile/orders/:orderId',
    component: OrderDetailsComponent,
    canActivate: [authGuard],
    data: { breadcrumb: 'Λεπτομέρειες Παραγγελίας' }
  },

  {
    path: 'profile/reviews',
    component: MyReviewsComponent,
    canActivate: [authGuard],
    data: { breadcrumb: 'Οι Κριτικές μου' }
  },

  // ===== ADMIN =====
  {
    path: 'admin',
    component: AdminDashboardComponent,
    canActivate: [adminGuard],
    data: { breadcrumb: 'Διαχείριση' }
  },

  {
    path: 'admin/products',
    component: AdminProductsComponent,
    canActivate: [adminGuard],
    data: { breadcrumb: 'Προϊόντα' }
  },

  {
    path: 'admin/products/new',
    component: ProductFormComponent,
    canActivate: [adminGuard],
    data: { breadcrumb: 'Νέο Προϊόν' }
  },

  {
    path: 'admin/products/edit/:id',
    component: ProductFormComponent,
    canActivate: [adminGuard],
    data: { breadcrumb: 'Επεξεργασία Προϊόντος' }
  },

  {
    path: 'admin/orders',
    component: AdminOrdersComponent,
    canActivate: [adminGuard],
    data: { breadcrumb: 'Παραγγελίες' }
  },

  {
    path: 'admin/orders/:orderId',
    loadComponent: () =>
      import('./order-details/order-details').then(m => m.OrderDetailsComponent),
    canActivate: [adminGuard],
    data: { breadcrumb: 'Λεπτομέρειες Παραγγελίας' }
  },

  {
    path: 'admin/reviews',
    component: AdminReviewsComponent,
    canActivate: [adminGuard],
    data: { breadcrumb: 'Κριτικές' }
  },

  {
    path: 'admin/discounts',
    component: AdminDiscountsComponent,
    canActivate: [authGuard, adminGuard],
    data: { breadcrumb: 'Κωδικοί Έκπτωσης' }
  },

  {
    path: 'admin/returns',
    component: AdminReturnsComponent,
    canActivate: [adminGuard],
    data: { breadcrumb: 'Αιτήματα Επιστροφής' }
  },

  // ===== ERROR (no breadcrumbs) =====
  { 
    path: '404', 
    component: NotFoundComponent 
  },

  { 
    path: '**', 
    component: NotFoundComponent 
  }

];
