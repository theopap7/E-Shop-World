import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  
  private apiUrl = 'http://localhost:3000/api';

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