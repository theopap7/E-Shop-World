import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { ProductDto } from '../../services/product.service';
import { ImageUrlPipe } from '../image-url.pipe';
import { STAR_CLASSES, starFill } from '../star-fill';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterModule, ImageUrlPipe],
  templateUrl: './product-card.html',
  styleUrls: ['./product-card.css']
})
export class ProductCardComponent {
  @Input({ required: true }) product!: ProductDto;
  @Input() inWishlist = false;
  @Input() cartQty = 0;
  @Output() addToCart = new EventEmitter<ProductDto>();
  @Output() toggleWishlist = new EventEmitter<ProductDto>();

  starClass(star: number, rating: number | string | null): string {
    return STAR_CLASSES[starFill(star, rating)];
  }

  onToggleWishlist(event: Event): void {
    event.stopPropagation();
    this.toggleWishlist.emit(this.product);
  }

  onAddToCart(event: Event): void {
    event.stopPropagation();
    this.addToCart.emit(this.product);
  }
}
