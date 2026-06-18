import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminService } from '../admin.service';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../toast.service';
import { environment } from '../../environments/environment';
import { Category, ProductImage } from '../product.service';
import { ImageUrlPipe } from '../shared/image-url.pipe';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ImageUrlPipe],
  templateUrl: './product-form.html',
  styleUrl: './product-form.css',
})
export class ProductFormComponent implements OnInit {

  form: FormGroup;

  isEditMode = false;
  productId: number | null = null;

  isLoading = false;
  error: string | null = null;

  categories: Category[] = [];

  // upload state
  uploading = false;
  uploadError = '';
  imagePreview = '';
  selectedFile: File | null = null;

  // drag state
  isDragging = false;

  // gallery
  galleryImages: ProductImage[] = [];
  uploadingGallery = false;

  // sizes
  readonly CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  readonly SHOE_SIZES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'];
  selectedSizes: string[] = [];

  get sizeMode(): 'clothing' | 'shoes' | 'none' {
    const catId = this.form.get('category_id')?.value;
    const cat = this.categories.find(c => c.id === catId);
    if (!cat) return 'none';
    const name = cat.name.toLowerCase();
    if (name.includes('ρούχ') || name.includes('ρουχ')) return 'clothing';
    if (name.includes('παπούτσ') || name.includes('παπουτσ')) return 'shoes';
    return 'none';
  }

  onCategoryChange(): void {
    this.selectedSizes = [];
  }

  isSizeSelected(s: string): boolean {
    return this.selectedSizes.includes(s);
  }

  toggleSize(s: string): void {
    if (this.isSizeSelected(s)) {
      this.selectedSizes = this.selectedSizes.filter(x => x !== s);
    } else {
      this.selectedSizes = [...this.selectedSizes, s];
    }
  }

  clearSizes(): void {
    this.selectedSizes = [];
  }

  private destroyRef = inject(DestroyRef);

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private toastService: ToastService
  ) {

    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      price: [0, [Validators.required, Validators.min(0)]],
      stock: [0, [Validators.required, Validators.min(0)]],
      category_id: [null],
      image_url: [''],
    });

  }

  ngOnInit(): void {
    this.loadCategories();

    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      this.isEditMode = true;
      this.productId = Number(id);
      this.loadProduct(this.productId);
    }
  }

  // =========================
  // LOAD DATA
  // =========================

  loadCategories(): void {

    this.http.get<{ success: boolean; categories: Category[] }>(`${environment.apiUrl}/categories`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({

      next: (res) => {
        if (res.success) {
          this.categories = res.categories;
        }
      },

      error: () => {},

    });

  }

  loadProduct(id: number): void {

    this.isLoading = true;

    this.adminService.getProduct(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({

      next: (res) => {

        if (res.success) {

          const p = res.product;

          this.form.patchValue({
            name: p.name,
            description: p.description || '',
            price: p.price,
            stock: p.stock,
            category_id: p.category_id,
            image_url: p.image_url || '',
          });

          this.imagePreview = p.image_url || '';
          this.selectedFile = null;
          this.uploadError = '';
          this.uploading = false;
          this.selectedSizes = Array.isArray(p.sizes) ? [...p.sizes] : [];
          this.loadGalleryImages(id);
        }

        this.isLoading = false;
      },

      error: (err) => {
        this.error = 'Σφάλμα φόρτωσης προϊόντος';
        this.isLoading = false;
      }

    });

  }

  // =========================
  // SAVE PRODUCT
  // =========================

  submit(): void {

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.error = null;

    const productData = {
      ...this.form.value,
      category_id: this.form.value.category_id || null,
      sizes: this.selectedSizes.length > 0 ? this.selectedSizes : null,
    };

    const request = this.isEditMode
      ? this.adminService.updateProduct(this.productId!, productData)
      : this.adminService.createProduct(productData);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({

      next: (res) => {

        if (res.success) {
          this.toastService.success(this.isEditMode ? 'Προϊόν ενημερώθηκε!' : 'Προϊόν δημιουργήθηκε!');
          this.router.navigate(['/admin/products']);
        }

        this.isLoading = false;
      },

      error: (err) => {
        this.error = err?.error?.message || 'Σφάλμα αποθήκευσης προϊόντος';
        this.isLoading = false;
      }

    });

  }

  // =========================
  // DRAG & DROP
  // =========================

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {

    event.preventDefault();
    this.isDragging = false;

    const file = event.dataTransfer?.files?.[0];

    if (!file) return;

    this.handleFile(file);

  }

  // =========================
  // FILE SELECT
  // =========================

  onFileSelected(event: Event): void {

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.handleFile(file);

  }

  // =========================
  // HANDLE FILE
  // =========================

  handleFile(file: File) {

    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.type)) {
      this.uploadError = 'Μόνο εικόνες επιτρέπονται (JPG, PNG, GIF, WEBP)';
      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      this.uploadError = 'Η εικόνα πρέπει να είναι μικρότερη από 5MB';
      return;
    }

    this.selectedFile = file;
    this.uploadError = '';

    const reader = new FileReader();

    reader.onload = () => {
      this.imagePreview = String(reader.result || '');
    };

    reader.readAsDataURL(file);

    this.uploadImage();

  }

  // =========================
  // UPLOAD IMAGE
  // =========================

  uploadImage(): void {

    if (!this.selectedFile) return;

    this.uploading = true;
    this.uploadError = '';

    const formData = new FormData();
    formData.append('image', this.selectedFile);

    this.http.post<{ success: boolean; imageUrl?: string; message?: string }>(
      `${environment.apiUrl}/upload-image`,
      formData
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({

      next: (res) => {

        if (res?.success) {

          this.form.get('image_url')?.setValue(res.imageUrl);

        } else {

          this.uploadError = res?.message || 'Upload failed';

        }

        this.uploading = false;

      },

      error: (err) => {
        this.uploadError = err?.error?.message || 'Σφάλμα ανεβάσματος εικόνας';
        this.uploading = false;
      }

    });

  }

  // =========================
  // GALLERY IMAGES
  // =========================

  loadGalleryImages(productId: number): void {
    this.http.get<{ success: boolean; images: ProductImage[] }>(
      `${environment.apiUrl}/admin/products/${productId}/images`
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => { if (res.success) this.galleryImages = res.images; },
      error: () => {}
    });
  }

  onGalleryFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploadGalleryImage(file);
  }

  uploadGalleryImage(file: File): void {
    if (!this.productId) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.toastService.error('Μόνο εικόνες επιτρέπονται (JPG, PNG, GIF, WEBP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toastService.error('Η εικόνα πρέπει να είναι μικρότερη από 5MB');
      return;
    }

    this.uploadingGallery = true;
    const formData = new FormData();
    formData.append('image', file);

    this.http.post<{ success: boolean; image: ProductImage }>(
      `${environment.apiUrl}/admin/products/${this.productId}/images`,
      formData
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success) {
          this.galleryImages = [...this.galleryImages, res.image];
          this.toastService.success('Εικόνα προστέθηκε στη gallery');
        }
        this.uploadingGallery = false;
      },
      error: () => {
        this.toastService.error('Αποτυχία ανεβάσματος εικόνας');
        this.uploadingGallery = false;
      }
    });
  }

  deleteGalleryImage(imageId: number): void {
    if (!this.productId) return;

    this.http.delete<{ success: boolean }>(
      `${environment.apiUrl}/admin/products/${this.productId}/images/${imageId}`
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success) {
          this.galleryImages = this.galleryImages.filter(img => img.id !== imageId);
          this.toastService.success('Εικόνα διαγράφηκε');
        }
      },
      error: () => { this.toastService.error('Αποτυχία διαγραφής εικόνας'); }
    });
  }

  // =========================
  // REMOVE IMAGE
  // =========================

  removeImage(): void {

    this.form.get('image_url')?.setValue('');

    this.imagePreview = '';
    this.selectedFile = null;
    this.uploadError = '';

  }

  // =========================
  // IMAGE FALLBACK
  // =========================

  onImgError(event: Event) {

    const img = event.target as HTMLImageElement;
    img.src = 'assets/no-image.png';

  }

}