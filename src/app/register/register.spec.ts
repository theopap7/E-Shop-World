import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { RegisterComponent } from './register';

describe('Register', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [provideHttpClient(), provideRouter([])],
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
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

  it('marks the form valid when both passwords match', () => {
    component.registerForm.setValue({
      firstName: 'Theo',
      lastName: 'Pap',
      email: 'theo@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });

    expect(component.registerForm.valid).toBeTrue();
    expect(component.registerForm.errors).toBeNull();
  });
});
