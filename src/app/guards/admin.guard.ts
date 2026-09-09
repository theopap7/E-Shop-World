import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  if (!auth.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  // Role must be confirmed against the server on every activation — the
  // cached localStorage copy can be edited client-side and isn't trustworthy.
  return auth.fetchCurrentUser().pipe(
    map((user) => {
      if (user.role === 'admin') {
        return true;
      }
      toast.error('Δεν έχετε δικαίωμα πρόσβασης σε αυτή τη σελίδα');
      router.navigate(['/dashboard']);
      return false;
    }),
    catchError(() => {
      router.navigate(['/login']);
      return of(false);
    })
  );
};
