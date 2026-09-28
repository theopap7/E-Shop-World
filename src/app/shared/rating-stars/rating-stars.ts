import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

const MAX_STARS = 5;

// Read-only star rating. Filled and empty stars use the same glyph family (★/☆) so they line up on one row.
@Component({
  selector: 'app-rating-stars',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="stars" role="img" [attr.aria-label]="rating + ' από 5'"><span class="on">{{ filled }}</span><span class="off">{{ empty }}</span></span>`,
  styles: [`
    .stars { letter-spacing: 1px; white-space: nowrap; }
    .on { color: #fbbf24; }
    .off { color: #d1d5db; }
  `],
})
export class RatingStarsComponent {
  @Input() rating = 0;

  get filled(): string {
    return '★'.repeat(this.clamped);
  }

  get empty(): string {
    return '★'.repeat(MAX_STARS - this.clamped);
  }

  private get clamped(): number {
    return Math.min(MAX_STARS, Math.max(0, Math.round(Number(this.rating) || 0)));
  }
}
