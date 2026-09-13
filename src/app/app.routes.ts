import { Routes } from '@angular/router';
import { RegisterComponent } from './register/register';
import { LoginComponent } from './login/login';
import { Dashboard } from './dashboard/dashboard';
import { CartComponent } from './cart/cart';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';
import { adminGuard } from './guards/admin.guard';
import { ProfileComponent } from './profile/profile';
import { MyOrdersComponent } from './my-orders/my-orders';
import { OrderDetailsComponent } from './order-details/order-details';
import { MyReviewsComponent } from './my-reviews/my-reviews';
import { MyReturnsComponent } from './my-returns/my-returns';
import { WishlistComponent } from './wishlist/wishlist';
import { AdminProductsComponent } from './admin/admin-products';
import { ProductFormComponent } from './admin/product-form';
import { AdminOrdersComponent } from './admin/admin-orders';
import { AdminReviewsComponent } from './admin/admin-reviews';
import { ProductDetailComponent } from './product-details/product-details';
import { NotFoundComponent } from './not-found/not-found';
import { AdminDiscountsComponent } from './admin-discounts/admin-discounts';
import { AdminReturnsComponent } from './admin/admin-returns';
import { AdminUsersComponent } from './admin/admin-users';
import { AdminCategoriesComponent } from './admin/admin-categories';
import { ForgotPasswordComponent } from './forgot-password/forgot-password';
import { ResetPasswordComponent } from './reset-password/reset-password';
import { VerifyEmailComponent } from './verify-email/verify-email';
import { AboutComponent } from './about/about';
import { TermsComponent } from './terms/terms';

export const routes: Routes = [

  {
    path: 'register',
    component: RegisterComponent,
    canActivate: [guestGuard]
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard]
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent
  },
  {
    path: 'reset-password',
    component: ResetPasswordComponent
  },
  {
    path: 'verify-email',
    component: VerifyEmailComponent
  },

  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },

  {
    path: 'dashboard',
    component: Dashboard,
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
    loadComponent: () =>
      import('./checkout/checkout').then(m => m.CheckoutComponent),
    canActivate: [authGuard],
    data: { breadcrumb: 'Ολοκλήρωση' }
  },

  {
    path: 'wishlist',
    component: WishlistComponent,
    data: { breadcrumb: 'Αγαπημένα' }
  },

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

  {
    path: 'profile/returns',
    component: MyReturnsComponent,
    canActivate: [authGuard],
    data: { breadcrumb: 'Οι Επιστροφές μου' }
  },

  {
    path: 'admin',
    loadComponent: () =>
      import('./admin/admin-dashboard').then(m => m.AdminDashboardComponent),
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

  {
    path: 'admin/users',
    component: AdminUsersComponent,
    canActivate: [adminGuard],
    data: { breadcrumb: 'Χρήστες' }
  },

  {
    path: 'admin/categories',
    component: AdminCategoriesComponent,
    canActivate: [adminGuard],
    data: { breadcrumb: 'Κατηγορίες' }
  },

  {
    path: 'about',
    component: AboutComponent,
    data: { breadcrumb: 'Σχετικά' }
  },

  {
    path: 'terms',
    component: TermsComponent,
    data: { breadcrumb: 'Όροι Χρήσης' }
  },

  {
    path: '404',
    component: NotFoundComponent
  },

  { 
    path: '**', 
    component: NotFoundComponent 
  }

];
