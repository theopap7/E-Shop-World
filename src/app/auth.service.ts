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
  token: string;
  user: AuthUser;
}

export interface RegisterResponse {
  success: boolean;
  message?: string;
}

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.apiUrl;

  // ✅ auth state
  private readonly userSubject = new BehaviorSubject<AuthUser | null>(this.getUser());
  readonly user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((res) => {
        if (res?.token) localStorage.setItem(TOKEN_KEY, res.token);
        if (res?.user) localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        this.userSubject.next(res?.user ?? null);
      })
    );
  }

  register(firstName: string, lastName: string, email: string, password: string): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/register`, { firstName, lastName, email, password });
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
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
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  isAdmin(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role === 'admin';
    } catch {
      return false;
    }
  }

  updateUser(user: AuthUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.userSubject.next(user);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    // ✅ δεν σβήνουμε carts — απλά δηλώνουμε "κανένας user"
    this.userSubject.next(null);
  }
}
