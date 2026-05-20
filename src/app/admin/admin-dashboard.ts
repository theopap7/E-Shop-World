import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminService, AdminStats } from '../admin.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
})
export class AdminDashboardComponent implements OnInit {
  stats: AdminStats | null = null;
  isLoading = true;
  error: string | null = null;

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.isLoading = true;
    this.error = null;

    this.adminService.getStats().subscribe({
      next: (res) => {
        if (res.success) {
          this.stats = res.stats;
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Stats error:', err);
        this.error = 'Failed to load statistics';
        this.isLoading = false;
      },
    });
  }
}
