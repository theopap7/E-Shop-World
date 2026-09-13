import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './skeleton.html',
  styleUrl: './skeleton.css'
})
export class SkeletonComponent {

  @Input() type: 'card' | 'text' | 'title' | 'image' | 'circle' = 'text';
  @Input() width?: string;
  @Input() height?: string;
  @Input() count = 1;

  get items(): number[] {
    return Array(this.count).fill(0).map((_, i) => i);
  }
}