import { Injectable } from '@angular/core';
import { Params } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class ProductListStateService {
  lastQueryParams: Params = {};
}
