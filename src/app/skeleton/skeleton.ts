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
  
  /**
   * Type of skeleton to render
   * - card: Full product card skeleton
   * - text: Single line text skeleton
   * - title: Larger text skeleton
   * - image: Image placeholder skeleton
   * - circle: Circular skeleton (for avatars)
   */
  @Input() type: 'card' | 'text' | 'title' | 'image' | 'circle' = 'text';
  
  /**
   * Width of skeleton (CSS value)
   */
  @Input() width?: string;
  
  /**
   * Height of skeleton (CSS value)
   */
  @Input() height?: string;
  
  /**
   * How many skeleton items to repeat
   */
  @Input() count = 1;
  
  /**
   * Generate array for *ngFor
   */
  get items(): number[] {
    return Array(this.count).fill(0).map((_, i) => i);
  }
}