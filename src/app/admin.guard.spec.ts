import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { adminGuard } from './admin.guard';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

describe('adminGuard', () => {
  let authSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let toastSpy: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('AuthService', ['isLoggedIn', 'isAdmin']);
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

  function runGuard() {
    return TestBed.runInInjectionContext(() => adminGuard({} as any, {} as any));
  }

  it('redirects to /login when the user is not logged in', () => {
    authSpy.isLoggedIn.and.returnValue(false);

    expect(runGuard()).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('redirects a logged-in non-admin to /dashboard with a toast warning', () => {
    authSpy.isLoggedIn.and.returnValue(true);
    authSpy.isAdmin.and.returnValue(false);

    expect(runGuard()).toBeFalse();
    expect(toastSpy.error).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('allows navigation for a logged-in admin', () => {
    authSpy.isLoggedIn.and.returnValue(true);
    authSpy.isAdmin.and.returnValue(true);

    expect(runGuard()).toBeTrue();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });
});
