import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
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

// Nominatim's Greek street-level index wants the city in genitive case ("Πάτρας"), not nominative ("Πάτρα").
function toGenitiveCity(city: string): string {
  const trimmed = city.trim();
  if (/ος$/.test(trimmed)) return trimmed.replace(/ος$/, 'ου');
  if (/[ηα]$/.test(trimmed)) return trimmed + 'ς';
  if (/ο$/.test(trimmed)) return trimmed.replace(/ο$/, 'ου');
  return trimmed;
}

interface AddressParts {
  address: string;
  city: string;
  zip: string;
  country: string;
}

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
  zipConfirmed = true;

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private query$ = new Subject<AddressParts>();
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
        debounceTime(1500),
        switchMap((parts) => this.geocode(parts))
      )
      .subscribe((result) => this.applyResult(result));

    setTimeout(() => this.ngOnChanges());
  }

  ngOnChanges(): void {
    if (!this.viewReady) return;
    const parts = this.buildParts();
    if (!parts) {
      this.status = 'idle';
      this.resetMap();
      return;
    }
    this.status = 'loading';
    this.query$.next(parts);
  }

  private resetMap(): void {
    this.zipConfirmed = true;
    if (this.marker) {
      this.marker.remove();
      this.marker = null;
    }
    this.map?.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private buildParts(): AddressParts | null {
    const address = this.address1?.trim() ?? '';
    const city = this.city?.trim() ?? '';
    const zip = this.zip?.trim() ?? '';
    const country = this.country?.trim() ?? '';
    if (!address || !city) return null;
    return { address, city, zip, country };
  }

  private candidateQueries(parts: AddressParts): string[] {
    const genitiveCity = toGenitiveCity(parts.city);
    const candidates = [
      [parts.address, genitiveCity, parts.country],
      [parts.address, parts.city, parts.country],
      [parts.address, genitiveCity, parts.zip, parts.country],
    ].map((p) => p.filter((x) => !!x).join(', '));
    return Array.from(new Set(candidates));
  }

  private pickByZip<T extends { address?: { postcode?: string } }>(
    results: T[],
    wantZip: string
  ): { match: T; confirmed: boolean } | null {
    const target = parseInt(wantZip, 10);
    if (Number.isNaN(target)) return null;

    const withZip = results
      .map((r) => ({ r, zip: (r.address?.postcode ?? '').replace(/\s+/g, '') }))
      .filter((x) => /^\d+$/.test(x.zip));
    if (withZip.length === 0) return null;

    const freq = new Map<string, number>();
    for (const x of withZip) freq.set(x.zip, (freq.get(x.zip) ?? 0) + 1);

    withZip.sort((a, b) => {
      const distanceDiff = Math.abs(+a.zip - target) - Math.abs(+b.zip - target);
      return distanceDiff !== 0 ? distanceDiff : freq.get(b.zip)! - freq.get(a.zip)!;
    });
    const best = withZip[0];
    return { match: best.r, confirmed: Math.abs(+best.zip - target) <= 1 };
  }

  private async geocode(
    parts: AddressParts
  ): Promise<{ lat: number; lon: number; zipConfirmed: boolean } | null> {
    const queries = this.candidateQueries(parts);
    const wantZip = parts.zip.replace(/\s+/g, '');

    for (let i = 0; i < queries.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1100)); // stay under Nominatim's 1 req/s policy

      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(queries[i])}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) {
          this.status = 'error';
          return null;
        }
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          if (!wantZip) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), zipConfirmed: true };

          const picked = this.pickByZip(data, wantZip);
          const best = picked?.match ?? data[0];
          const zipConfirmed = picked ? picked.confirmed : true;
          return { lat: parseFloat(best.lat), lon: parseFloat(best.lon), zipConfirmed };
        }
      } catch {
        this.status = 'error';
        return null;
      }
    }

    this.status = 'not-found';
    return null;
  }

  private applyResult(result: { lat: number; lon: number; zipConfirmed: boolean } | null): void {
    if (!this.map || !result) return;

    this.status = 'found';
    this.zipConfirmed = result.zipConfirmed;
    const latLng: [number, number] = [result.lat, result.lon];

    if (!this.marker) {
      this.marker = L.marker(latLng, { icon: markerIcon }).addTo(this.map);
    } else {
      this.marker.setLatLng(latLng);
    }

    this.map.setView(latLng, FOUND_ZOOM);
  }
}
