import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService, AdminUser } from '../services/admin.service';
import { PaginationComponent } from '../shared/pagination/pagination';
import { matchesSearch } from '../shared/search-text';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PaginationComponent],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.css',
})
export class AdminUsersComponent implements OnInit {
  users: AdminUser[] = [];
  isLoading = true;
  error: string | null = null;
  searchTerm = '';
  currentPage = 1;
  readonly pageSize = 20;

  private destroyRef = inject(DestroyRef);

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.error = null;
    this.adminService.getUsers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success) this.users = res.users;
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Σφάλμα φόρτωσης χρηστών';
        this.isLoading = false;
      },
    });
  }

  get filteredUsers(): AdminUser[] {
    if (!this.searchTerm.trim()) return this.users;
    return this.users.filter(u =>
      matchesSearch(this.searchTerm, u.first_name, u.last_name, u.email)
    );
  }

  get pagedUsers(): AdminUser[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredUsers.slice(start, start + this.pageSize);
  }

  onSearchChange(): void {
    this.currentPage = 1;
  }
}
