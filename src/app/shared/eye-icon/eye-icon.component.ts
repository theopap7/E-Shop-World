import { Component, Input } from '@angular/core';

// Password visibility icon drawn with currentColor so it matches the text instead of rendering as a system emoji.
@Component({
  selector: 'app-eye-icon',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @if (crossed) {
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      } @else {
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      }
    </svg>
  `,
  styles: [`:host { display: inline-flex; }`],
})
export class EyeIconComponent {
  /** Draw the eye with a slash through it (password currently visible). */
  @Input() crossed = false;
}
