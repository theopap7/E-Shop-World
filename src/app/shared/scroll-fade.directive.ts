import { AfterViewInit, Directive, ElementRef, HostBinding, HostListener, NgZone, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appScrollFade]',
  standalone: true,
})
export class ScrollFadeDirective implements AfterViewInit, OnDestroy {
  @HostBinding('class.has-more') hasMore = false;

  private resizeObserver?: ResizeObserver;

  constructor(private host: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => this.zone.run(() => this.update()));
    this.resizeObserver.observe(this.host.nativeElement);
    this.update();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  @HostListener('scroll')
  update(): void {
    const el = this.host.nativeElement;
    this.hasMore = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
  }
}
