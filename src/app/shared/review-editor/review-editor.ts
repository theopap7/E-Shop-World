import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ReviewDraft {
  rating: number;
  comment: string;
}

@Component({
  selector: 'app-review-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './review-editor.html',
  styleUrls: ['./review-editor.css']
})
export class ReviewEditorComponent implements OnInit {
  @Input() rating = 0;
  @Input() comment: string | null = '';
  @Input() saving = false;
  @Input() error = '';
  @Output() save = new EventEmitter<ReviewDraft>();
  @Output() cancel = new EventEmitter<void>();

  readonly stars = [1, 2, 3, 4, 5];
  draftRating = 0;
  draftComment = '';
  hoveredRating = 0;

  ngOnInit(): void {
    this.draftRating = this.rating;
    this.draftComment = this.comment || '';
  }

  isFilled(star: number): boolean {
    return star <= (this.hoveredRating || this.draftRating);
  }

  submit(): void {
    this.save.emit({ rating: this.draftRating, comment: this.draftComment });
  }
}
