import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../environments/environment';

@Pipe({ name: 'imageUrl', standalone: true })
export class ImageUrlPipe implements PipeTransform {
  transform(url: string | null | undefined): string {
    if (!url) return 'no-image.svg';
    if (url.startsWith('data:')) return url;
    if (url.startsWith('https://')) return url;
    if (url.startsWith('http://')) {
      try {
        return environment.baseUrl + new URL(url).pathname;
      } catch {
        return url;
      }
    }
    return environment.baseUrl + url;
  }
}
