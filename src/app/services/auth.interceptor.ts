import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const toast = inject(ToastService);

  const skipAutoLogout = ['/logout', '/login', '/change-password'];

  return next(req.clone({ withCredentials: true })).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !skipAutoLogout.some((path) => req.url.includes(path))) {
        auth.logout();
        toast.info('Η συνεδρία σου έληξε. Παρακαλώ συνδέσου ξανά.');
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
