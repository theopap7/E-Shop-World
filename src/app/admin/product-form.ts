import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { concat, of } from 'rxjs';
import { catchError, map, toArray } from 'rxjs/operators';
import { AdminService } from '../services/admin.service';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../services/toast.service';
import { environment } from '../../environments/environment';
import { Category, ProductImage } from '../services/product.service';
import { ImageUrlPipe } from '../shared/image-url.pipe';
import { CLOTHING_SIZES as CLOTHING_SIZE_OPTIONS, SHOE_SIZES as SHOE_SIZE_OPTIONS, sortSizes } from '../services/size-order.util';

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
  isLoadingProduct = false;
  loadFailed = false;
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
  pendingGalleryFiles: { file: File; preview: string }[] = [];
  pendingGalleryDeletes: number[] = [];

  get visibleGalleryImages(): ProductImage[] {
    return this.galleryImages.filter(img => !this.pendingGalleryDeletes.includes(img.id));
  }

  // sizes
  readonly CLOTHING_SIZES = CLOTHING_SIZE_OPTIONS;
  readonly SHOE_SIZES = SHOE_SIZE_OPTIONS;
  selectedSizes: string[] = [];
  sizeStock: Record<string, number> = {};

  sizeMode: 'clothing' | 'shoes' | 'none' = 'none';

  private suggestSizeMode(): 'clothing' | 'shoes' | 'none' {
    const catId = this.form.get('category_id')?.value;
    const cat = this.categories.find(c => c.id === catId);
    if (!cat) return 'none';
    const name = cat.name.toLowerCase();
    if (name.includes('ρούχ') || name.includes('ρουχ')) return 'clothing';
    if (name.includes('παπούτσ') || name.includes('παπουτσ')) return 'shoes';
    return 'none';
  }

  private sizeModeFor(sizes: string[]): 'clothing' | 'shoes' | 'none' {
    if (sizes.length === 0) return 'none';
    return sizes.some(s => this.SHOE_SIZES.includes(s)) ? 'shoes' : 'clothing';
  }

  onCategoryChange(): void {
    if (!this.isEditMode && this.selectedSizes.length === 0) {
      this.sizeMode = this.suggestSizeMode();
    }
  }

  setSizeMode(mode: 'clothing' | 'shoes' | 'none'): void {
    if (mode === this.sizeMode) return;
    this.sizeMode = mode;
    this.selectedSizes = [];
    this.sizeStock = {};
  }

  isSizeSelected(s: string): boolean {
    return this.selectedSizes.includes(s);
  }

  get sortedSelectedSizes(): string[] {
    return sortSizes(this.selectedSizes);
  }

  toggleSize(s: string): void {
    if (this.isSizeSelected(s)) {
      this.selectedSizes = this.selectedSizes.filter(x => x !== s);
    } else {
      this.selectedSizes = [...this.selectedSizes, s];
      this.sizeStock[s] ??= 0;
    }
  }

  clearSizes(): void {
    this.selectedSizes = [];
    this.sizeStock = {};
    this.form.get('stock')?.setValue(0);
  }

  getSizeStock(s: string): number {
    return this.sizeStock[s] ?? 0;
  }

  setSizeStock(s: string, value: string): void {
    const n = Number(value);
    this.sizeStock[s] = Number.isFinite(n) && n >= 0 ? n : 0;
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
      price: [0, [Validators.required, Validators.min(0.01)]],
      stock: [0, [Validators.required, Validators.min(0)]],
      category_id: [null],
      image_url: [''],
    });
  }

  ngOnInit(): void {
    this.loadCategories();

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');

      if (id) {
        this.isEditMode = true;
        this.productId = Number(id);
        this.loadProduct(this.productId);
      } else {
        this.isEditMode = false;
        this.productId = null;
        this.form.reset({ name: '', description: '', price: 0, stock: 0, category_id: null, image_url: '' });
        this.selectedSizes = [];
        this.sizeStock = {};
        this.sizeMode = 'none';
        this.galleryImages = [];
        this.pendingGalleryFiles = [];
        this.pendingGalleryDeletes = [];
      }
    });
  }

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
    this.isLoadingProduct = true;
    this.loadFailed = false;

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
          this.sizeStock = { ...(p.sizeStock || {}) };
          this.sizeMode = this.sizeModeFor(this.selectedSizes);
          this.loadGalleryImages(id);
        }

        this.isLoadingProduct = false;
      },
      error: () => {
        this.loadFailed = true;
        this.isLoadingProduct = false;
      }
    });
  }

  submit(): void {
    if (this.isLoadingProduct || this.isLoading || this.uploading) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.sizeMode !== 'none' && this.selectedSizes.length === 0) {
      this.error = 'Επίλεξε τουλάχιστον ένα μέγεθος για αυτή την κατηγορία.';
      return;
    }

    this.isLoading = true;
    this.error = null;

    const sortedSizes = sortSizes(this.selectedSizes);
    const hasSizes = sortedSizes.length > 0;

    const productData = {
      ...this.form.value,
      category_id: this.form.value.category_id || null,
      stock: hasSizes
        ? sortedSizes.reduce((sum, s) => sum + this.getSizeStock(s), 0)
        : this.form.value.stock,
      sizes: hasSizes ? sortedSizes : null,
      sizeStock: hasSizes
        ? Object.fromEntries(sortedSizes.map(s => [s, this.getSizeStock(s)]))
        : undefined,
    };

    const request = this.isEditMode
      ? this.adminService.updateProduct(this.productId!, productData)
      : this.adminService.createProduct(productData);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (!res.success) {
          this.isLoading = false;
          return;
        }

        this.adminService.invalidateStatsCache();
        this.toastService.success(this.isEditMode ? 'Προϊόν ενημερώθηκε!' : 'Προϊόν δημιουργήθηκε!');

        const productId = this.isEditMode ? this.productId : res.productId;
        if (!productId || (this.pendingGalleryFiles.length === 0 && this.pendingGalleryDeletes.length === 0)) {
          this.isLoading = false;
          this.router.navigate(['/admin/products']);
          return;
        }

        this.savePendingGallery(productId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(results => {
          const failed = results.filter(ok => !ok).length;
          if (failed > 0) {
            this.toastService.warning(`${failed} από τις αλλαγές στη συλλογή εικόνων δεν αποθηκεύτηκαν. Δοκίμασε ξανά από την επεξεργασία.`);
          }
          this.isLoading = false;
          this.router.navigate(['/admin/products']);
        });
      },
      error: (err) => {
        this.error = err?.error?.message || 'Σφάλμα αποθήκευσης προϊόντος';
        this.isLoading = false;
      }
    });
  }

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

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.handleFile(file);
  }

  handleFile(file: File) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
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
      if (this.selectedFile === file) {
        this.imagePreview = String(reader.result || '');
      }
    };
    reader.readAsDataURL(file);

    this.uploadImage();
  }

  private revertImagePreview(): void {
    this.selectedFile = null;
    this.imagePreview = this.form.get('image_url')?.value || '';
  }

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
          this.uploadError = res?.message || 'Ανέβασμα απέτυχε';
          this.revertImagePreview();
        }

        this.uploading = false;
      },
      error: (err) => {
        this.uploadError = err?.error?.message || 'Σφάλμα ανεβάσματος εικόνας';
        this.revertImagePreview();
        this.uploading = false;
      }
    });
  }

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
    if (!file || !this.isValidGalleryFile(file)) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.pendingGalleryFiles = [...this.pendingGalleryFiles, { file, preview: String(reader.result || '') }];
    };
    reader.readAsDataURL(file);
  }

  removePendingGalleryFile(index: number): void {
    this.pendingGalleryFiles = this.pendingGalleryFiles.filter((_, i) => i !== index);
  }

  private isValidGalleryFile(file: File): boolean {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.toastService.error('Μόνο εικόνες επιτρέπονται (JPG, PNG, GIF, WEBP)');
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toastService.error('Η εικόνα πρέπει να είναι μικρότερη από 5MB');
      return false;
    }
    return true;
  }

  private postGalleryImage(productId: number, file: File) {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<{ success: boolean; image: ProductImage }>(
      `${environment.apiUrl}/admin/products/${productId}/images`,
      formData
    );
  }

  private savePendingGallery(productId: number) {
    const uploads = this.pendingGalleryFiles.map(({ file }) =>
      this.postGalleryImage(productId, file).pipe(
        map(() => true),
        catchError(() => of(false))
      )
    );
    const deletes = this.pendingGalleryDeletes.map(imageId =>
      this.http.delete<{ success: boolean }>(`${environment.apiUrl}/admin/products/${productId}/images/${imageId}`).pipe(
        map(() => true),
        catchError(() => of(false))
      )
    );
    return concat(...uploads, ...deletes).pipe(toArray());
  }

  removeGalleryImage(imageId: number): void {
    this.pendingGalleryDeletes = [...this.pendingGalleryDeletes, imageId];
  }

  removeImage(): void {
    this.form.get('image_url')?.setValue('');
    this.imagePreview = '';
    this.selectedFile = null;
    this.uploadError = '';
  }

  onImgError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.src = 'no-image.svg';
  }
}
