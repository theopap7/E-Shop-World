import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { RegisterComponent } from './register';
import { AuthService } from '../services/auth.service';

describe('Register', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let authService: AuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [provideHttpClient(), provideRouter([])],
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    // email field runs an async validator (500ms debounce + HTTP call) — stub
    // it so tests don't depend on a real backend being up.
    spyOn(authService, 'checkEmail').and.returnValue(of({ success: true, exists: false }));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('marks the form invalid with a "mismatch" error when passwords differ', () => {
    component.registerForm.setValue({
      firstName: 'Theo',
      lastName: 'Pap',
      email: 'theo@example.com',
      password: 'password123',
      confirmPassword: 'password124',
    });

    expect(component.registerForm.valid).toBeFalse();
    expect(component.registerForm.errors?.['mismatch']).toBeTrue();
  });

  it('marks the form valid when both passwords match', fakeAsync(() => {
    component.registerForm.setValue({
      firstName: 'Theo',
      lastName: 'Pap',
      email: 'theo@example.com',
      password: 'Password123',
      confirmPassword: 'Password123',
    });

    tick(500); // let the email async validator's debounce + stubbed HTTP call resolve

    expect(component.registerForm.valid).toBeTrue();
    expect(component.registerForm.errors).toBeNull();
  }));
});
