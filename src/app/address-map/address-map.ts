import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  SimpleChanges,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import * as L from 'leaflet';

// Leaflet's default marker icon URLs break under most bundlers — point them at the CDN instead.
const markerIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const DEFAULT_CENTER: [number, number] = [38.0, 23.73]; // Greece
const DEFAULT_ZOOM = 6;
const FOUND_ZOOM = 16;

@Component({
  selector: 'app-address-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './address-map.html',
  styleUrl: './address-map.css',
})
export class AddressMapComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() city = '';
  @Input() zip = '';
  @Input() address1 = '';
  @Input() country = 'ΕΛΛΑΔΑ';

  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  status: 'idle' | 'loading' | 'found' | 'not-found' | 'error' = 'idle';

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private query$ = new Subject<string>();
  private viewReady = false;

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);
    this.viewReady = true;

    this.query$
      .pipe(
        debounceTime(900),
        distinctUntilChanged(),
        switchMap((q) => this.geocode(q))
      )
      .subscribe((result) => this.applyResult(result));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady) return;
    const query = this.buildQuery();
    if (!query) {
      this.status = 'idle';
      return;
    }
    this.status = 'loading';
    this.query$.next(query);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private buildQuery(): string {
    const parts = [this.address1?.trim(), this.city?.trim(), this.zip?.trim(), this.country?.trim()]
      .filter((p) => !!p);
    // require at least street + city before we bother the geocoder
    if (!this.address1?.trim() || !this.city?.trim()) return '';
    return parts.join(', ');
  }

  private async geocode(query: string): Promise<{ lat: number; lon: number } | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    } catch {
      return null;
    }
  }

  private applyResult(result: { lat: number; lon: number } | null): void {
    if (!this.map) return;

    if (!result) {
      this.status = 'not-found';
      return;
    }

    this.status = 'found';
    const latLng: [number, number] = [result.lat, result.lon];

    if (!this.marker) {
      this.marker = L.marker(latLng, { icon: markerIcon }).addTo(this.map);
    } else {
      this.marker.setLatLng(latLng);
    }

    this.map.setView(latLng, FOUND_ZOOM);
  }
}
