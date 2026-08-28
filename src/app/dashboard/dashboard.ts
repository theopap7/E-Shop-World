import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ProductListComponent } from '../product.list.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ProductListComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {}
