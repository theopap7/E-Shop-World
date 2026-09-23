import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError, isObservable, firstValueFrom } from 'rxjs';
import { adminGuard } from './admin.guard';
import { AuthService, AuthUser } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

describe('adminGuard', () => {
  let authSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let toastSpy: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('AuthService', ['isLoggedIn', 'fetchCurrentUser']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    toastSpy = jasmine.createSpyObj('ToastService', ['error']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ToastService, useValue: toastSpy },
      ],
    });
  });

  async function runGuard(): Promise<boolean> {
    const result = TestBed.runInInjectionContext(() => adminGuard({} as any, {} as any));
    return isObservable(result) ? firstValueFrom(result as any) : (result as any);
  }

  it('redirects to /login when the user is not logged in', async () => {
    authSpy.isLoggedIn.and.returnValue(false);

    expect(await runGuard()).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    expect(authSpy.fetchCurrentUser).not.toHaveBeenCalled();
  });

  it('redirects a logged-in non-admin to /dashboard with a toast warning', async () => {
    authSpy.isLoggedIn.and.returnValue(true);
    authSpy.fetchCurrentUser.and.returnValue(of({ role: 'user' } as AuthUser));

    expect(await runGuard()).toBeFalse();
    expect(toastSpy.error).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('allows navigation for a logged-in admin confirmed by the server', async () => {
    authSpy.isLoggedIn.and.returnValue(true);
    authSpy.fetchCurrentUser.and.returnValue(of({ role: 'admin' } as AuthUser));

    expect(await runGuard()).toBeTrue();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('keeps the admin on the current page when the server is unreachable', async () => {
    authSpy.isLoggedIn.and.returnValue(true);
    authSpy.fetchCurrentUser.and.returnValue(throwError(() => ({ status: 0 })));
    (routerSpy as any).navigated = true;

    expect(await runGuard()).toBeFalse();
    expect(toastSpy.error).toHaveBeenCalledWith('Ο διακομιστής δεν απαντά. Δοκίμασε ξανά σε λίγο.');
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('sends the admin to /dashboard when the server is unreachable on first load', async () => {
    authSpy.isLoggedIn.and.returnValue(true);
    authSpy.fetchCurrentUser.and.returnValue(throwError(() => ({ status: 0 })));

    expect(await runGuard()).toBeFalse();
    expect(toastSpy.error).toHaveBeenCalledWith('Ο διακομιστής δεν απαντά. Δοκίμασε ξανά σε λίγο.');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('redirects to /login when a locally-forged admin flag fails server verification', async () => {
    // Regression test: localStorage can be edited client-side (e.g. role: 'admin'
    // spoofed via devtools), so isLoggedIn() alone must never be enough to admit access.
    authSpy.isLoggedIn.and.returnValue(true);
    authSpy.fetchCurrentUser.and.returnValue(throwError(() => new Error('403')));

    expect(await runGuard()).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });
});
