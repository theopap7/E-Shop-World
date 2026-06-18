import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.css']
})
export class PaginationComponent implements OnChanges {
  @Input() total = 0;
  @Input() pageSize = 20;
  @Input() currentPage = 1;
  @Output() pageChange = new EventEmitter<number>();

  totalPages = 0;
  pages: number[] = [];

  ngOnChanges(): void {
    this.totalPages = Math.ceil(this.total / this.pageSize);
    this.pages = this.buildPages();
  }

  private buildPages(): number[] {
    const total = this.totalPages;
    const current = this.currentPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: number[] = [1];
    if (current > 3) pages.push(-1); // ellipsis

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (current < total - 2) pages.push(-1); // ellipsis
    pages.push(total);
    return pages;
  }

  go(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.pageChange.emit(page);
  }

  get from(): number { return Math.min((this.currentPage - 1) * this.pageSize + 1, this.total); }
  get to(): number { return Math.min(this.currentPage * this.pageSize, this.total); }
}
