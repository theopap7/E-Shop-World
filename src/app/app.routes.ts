import { ActivatedRouteSnapshot, ResolveFn, Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';
import { adminGuard } from './guards/admin.guard';

const orderTitle: ResolveFn<string> = (route: ActivatedRouteSnapshot) =>
  `Παραγγελία #${route.paramMap.get('orderId')}`;

const adminOrderTitle: ResolveFn<string> = (route: ActivatedRouteSnapshot) =>
  `Παραγγελία #${route.paramMap.get('orderId')} – Διαχείριση`;

export const routes: Routes = [

  {
    path: 'register',
    title: 'Εγγραφή',
    loadComponent: () => import('./register/register').then(m => m.RegisterComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'login',
    title: 'Σύνδεση',
    loadComponent: () => import('./login/login').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'forgot-password',
    title: 'Ξέχασες τον κωδικό σου',
    loadComponent: () => import('./forgot-password/forgot-password').then(m => m.ForgotPasswordComponent)
  },
  {
    path: 'reset-password',
    title: 'Νέος κωδικός',
    loadComponent: () => import('./reset-password/reset-password').then(m => m.ResetPasswordComponent)
  },
  {
    path: 'verify-email',
    title: 'Επιβεβαίωση email',
    loadComponent: () => import('./verify-email/verify-email').then(m => m.VerifyEmailComponent)
  },

  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },

  {
    path: 'dashboard',
    title: 'Προϊόντα',
    component: Dashboard,
    data: { breadcrumb: 'Προϊόντα' }
  },

  {
    path: 'cart',
    title: 'Καλάθι',
    loadComponent: () => import('./cart/cart').then(m => m.CartComponent),
    data: { breadcrumb: 'Καλάθι' }
  },

  {
    path: 'products/:id',
    title: 'Προϊόν',
    loadComponent: () => import('./product-details/product-details').then(m => m.ProductDetailComponent),
    data: { breadcrumb: 'Προϊόν' }
  },

  {
    path: 'checkout',
    title: 'Ολοκλήρωση παραγγελίας',
    loadComponent: () => import('./checkout/checkout').then(m => m.CheckoutComponent),
    canActivate: [authGuard],
    data: { breadcrumb: 'Ολοκλήρωση' }
  },

  {
    path: 'wishlist',
    title: 'Αγαπημένα',
    loadComponent: () => import('./wishlist/wishlist').then(m => m.WishlistComponent),
    data: { breadcrumb: 'Αγαπημένα' }
  },

  {
    path: 'profile',
    title: 'Το προφίλ μου',
    loadComponent: () => import('./profile/profile').then(m => m.ProfileComponent),
    canActivate: [authGuard],
    data: { breadcrumb: 'Προφίλ' }
  },

  {
    path: 'profile/orders',
    title: 'Οι παραγγελίες μου',
    loadComponent: () => import('./my-orders/my-orders').then(m => m.MyOrdersComponent),
    canActivate: [authGuard],
    data: { breadcrumb: 'Παραγγελίες' }
  },

  {
    path: 'profile/orders/:orderId',
    title: orderTitle,
    loadComponent: () => import('./order-details/order-details').then(m => m.OrderDetailsComponent),
    canActivate: [authGuard],
    data: { breadcrumb: 'Λεπτομέρειες Παραγγελίας' }
  },

  {
    path: 'profile/reviews',
    title: 'Οι κριτικές μου',
    loadComponent: () => import('./my-reviews/my-reviews').then(m => m.MyReviewsComponent),
    canActivate: [authGuard],
    data: { breadcrumb: 'Οι Κριτικές μου' }
  },

  {
    path: 'profile/returns',
    title: 'Οι επιστροφές μου',
    loadComponent: () => import('./my-returns/my-returns').then(m => m.MyReturnsComponent),
    canActivate: [authGuard],
    data: { breadcrumb: 'Οι Επιστροφές μου' }
  },

  {
    path: 'admin',
    title: 'Διαχείριση',
    loadComponent: () => import('./admin/admin-dashboard').then(m => m.AdminDashboardComponent),
    canActivate: [adminGuard],
    data: { breadcrumb: 'Διαχείριση' }
  },

  {
    path: 'admin/products',
    title: 'Προϊόντα – Διαχείριση',
    loadComponent: () => import('./admin/admin-products').then(m => m.AdminProductsComponent),
    canActivate: [adminGuard],
    data: { breadcrumb: 'Προϊόντα' }
  },

  {
    path: 'admin/products/new',
    title: 'Νέο προϊόν – Διαχείριση',
    loadComponent: () => import('./admin/product-form').then(m => m.ProductFormComponent),
    canActivate: [adminGuard],
    data: { breadcrumb: 'Νέο Προϊόν' }
  },

  {
    path: 'admin/products/edit/:id',
    title: 'Επεξεργασία προϊόντος – Διαχείριση',
    loadComponent: () => import('./admin/product-form').then(m => m.ProductFormComponent),
    canActivate: [adminGuard],
    data: { breadcrumb: 'Επεξεργασία Προϊόντος' }
  },

  {
    path: 'admin/orders',
    title: 'Παραγγελίες – Διαχείριση',
    loadComponent: () => import('./admin/admin-orders').then(m => m.AdminOrdersComponent),
    canActivate: [adminGuard],
    data: { breadcrumb: 'Παραγγελίες' }
  },

  {
    path: 'admin/orders/:orderId',
    title: adminOrderTitle,
    loadComponent: () => import('./order-details/order-details').then(m => m.OrderDetailsComponent),
    canActivate: [adminGuard],
    data: { breadcrumb: 'Λεπτομέρειες Παραγγελίας' }
  },

  {
    path: 'admin/reviews',
    title: 'Κριτικές – Διαχείριση',
    loadComponent: () => import('./admin/admin-reviews').then(m => m.AdminReviewsComponent),
    canActivate: [adminGuard],
    data: { breadcrumb: 'Κριτικές' }
  },

  {
    path: 'admin/discounts',
    title: 'Κωδικοί έκπτωσης – Διαχείριση',
    loadComponent: () => import('./admin-discounts/admin-discounts').then(m => m.AdminDiscountsComponent),
    canActivate: [authGuard, adminGuard],
    data: { breadcrumb: 'Κωδικοί Έκπτωσης' }
  },

  {
    path: 'admin/returns',
    title: 'Επιστροφές – Διαχείριση',
    loadComponent: () => import('./admin/admin-returns').then(m => m.AdminReturnsComponent),
    canActivate: [adminGuard],
    data: { breadcrumb: 'Αιτήματα Επιστροφής' }
  },

  {
    path: 'admin/users',
    title: 'Χρήστες – Διαχείριση',
    loadComponent: () => import('./admin/admin-users').then(m => m.AdminUsersComponent),
    canActivate: [adminGuard],
    data: { breadcrumb: 'Χρήστες' }
  },

  {
    path: 'admin/categories',
    title: 'Κατηγορίες – Διαχείριση',
    loadComponent: () => import('./admin/admin-categories').then(m => m.AdminCategoriesComponent),
    canActivate: [adminGuard],
    data: { breadcrumb: 'Κατηγορίες' }
  },

  {
    path: 'about',
    title: 'Σχετικά',
    loadComponent: () => import('./about/about').then(m => m.AboutComponent),
    data: { breadcrumb: 'Σχετικά' }
  },

  {
    path: 'terms',
    title: 'Όροι χρήσης',
    loadComponent: () => import('./terms/terms').then(m => m.TermsComponent),
    data: { breadcrumb: 'Όροι Χρήσης' }
  },

  {
    path: '404',
    title: 'Η σελίδα δεν βρέθηκε',
    loadComponent: () => import('./not-found/not-found').then(m => m.NotFoundComponent)
  },

  {
    path: '**',
    title: 'Η σελίδα δεν βρέθηκε',
    loadComponent: () => import('./not-found/not-found').then(m => m.NotFoundComponent)
  }

];
