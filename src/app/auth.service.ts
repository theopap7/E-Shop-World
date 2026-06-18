import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { environment } from '../environments/environment';

export interface AuthUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
}

export interface LoginResponse {
  success: boolean;
  expiresAt: number;
  user: AuthUser;
}

export interface RegisterResponse {
  success: boolean;
  message?: string;
}

const USER_KEY = 'user';
const EXPIRES_KEY = 'expiresAt';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.apiUrl;

  private readonly userSubject = new BehaviorSubject<AuthUser | null>(this.getUser());
  readonly user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password }, { withCredentials: true }).pipe(
      tap((res) => {
        if (res?.user) {
          localStorage.removeItem('token');
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
          localStorage.setItem(EXPIRES_KEY, String(res.expiresAt));
        }
        this.userSubject.next(res?.user ?? null);
      })
    );
  }

  register(firstName: string, lastName: string, email: string, password: string): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/register`, { firstName, lastName, email, password });
  }

  getUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    const user = this.getUser();
    if (!user) return false;
    const expiresAt = Number(localStorage.getItem(EXPIRES_KEY));
    if (!expiresAt) return false;
    return expiresAt > Date.now();
  }

  isAdmin(): boolean {
    const user = this.getUser();
    return user?.role === 'admin';
  }

  updateUser(user: AuthUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.userSubject.next(user);
  }

  logout(): void {
    this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true }).subscribe();
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    localStorage.removeItem('token');
    this.userSubject.next(null);
  }
}
