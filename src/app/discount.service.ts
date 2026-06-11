import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface DiscountValidationResponse {
  success: boolean;
  message?: string;
  discount?: {
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    amount: number;
  };
}

@Injectable({ providedIn: 'root' })
export class DiscountService {
  
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Validate discount code
   */
  validateDiscount(code: string, orderTotal: number): Observable<DiscountValidationResponse> {
    return this.http.post<DiscountValidationResponse>(
      `${this.apiUrl}/validate-discount`,
      { code, orderTotal }
    );
  }
}