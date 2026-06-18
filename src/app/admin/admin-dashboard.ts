import { Component, OnInit, OnDestroy, DestroyRef, inject, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminService, AdminStats, ChartData } from '../admin.service';
import {
  Chart,
  LineController, BarController, DoughnutController,
  LineElement, BarElement, ArcElement,
  PointElement, CategoryScale, LinearScale,
  Tooltip, Legend, Filler
} from 'chart.js';

Chart.register(
  LineController, BarController, DoughnutController,
  LineElement, BarElement, ArcElement,
  PointElement, CategoryScale, LinearScale,
  Tooltip, Legend, Filler
);

const STATUS_LABELS: Record<string, string> = {
  pending: 'Αναμονή',
  processing: 'Επεξεργασία',
  shipped: 'Απεστάλη',
  delivered: 'Παραδόθηκε',
  cancelled: 'Ακυρώθηκε'
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
})
export class AdminDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  stats: AdminStats | null = null;
  isLoading = true;
  error: string | null = null;

  @ViewChild('revenueCanvas') revenueCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('statusCanvas') statusCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('topProductsCanvas') topProductsCanvas!: ElementRef<HTMLCanvasElement>;

  private revenueChart: Chart | null = null;
  private statusChart: Chart | null = null;
  private topProductsChart: Chart | null = null;

  private destroyRef = inject(DestroyRef);

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.revenueChart?.destroy();
    this.statusChart?.destroy();
    this.topProductsChart?.destroy();
  }

  loadDashboard(): void {
    this.isLoading = true;
    this.error = null;
    this.adminService.getDashboardData().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.stats = res.stats;
          if (res.charts) {
            setTimeout(() => this.renderCharts(res.charts), 0);
          }
        }
      },
      error: () => {
        this.error = 'Σφάλμα φόρτωσης στατιστικών';
        this.isLoading = false;
      }
    });
  }

  private renderCharts(data: ChartData): void {
    if (!data) return;
    this.renderRevenueChart(data.dailyOrders ?? []);
    this.renderStatusChart(data.statusBreakdown ?? []);
    this.renderTopProductsChart(data.topProducts ?? []);
  }

  private renderRevenueChart(raw: ChartData['dailyOrders']): void {
    const days = this.getLast30Days();
    const revenueMap: Record<string, number> = {};
    const ordersMap: Record<string, number> = {};
    for (const row of raw) {
      const key = row.day.slice(0, 10);
      revenueMap[key] = Number(row.revenue);
      ordersMap[key] = Number(row.orders);
    }

    const labels = days.map(d => d.slice(5));
    const revenueData = days.map(d => revenueMap[d] ?? 0);
    const ordersData = days.map(d => ordersMap[d] ?? 0);

    this.revenueChart?.destroy();
    this.revenueChart = new Chart(this.revenueCanvas.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Έσοδα (€)',
            data: revenueData,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37,99,235,0.08)',
            fill: true,
            tension: 0.4,
            yAxisID: 'yRevenue',
            pointRadius: 3,
            pointHoverRadius: 5
          },
          {
            label: 'Παραγγελίες',
            data: ordersData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.08)',
            fill: true,
            tension: 0.4,
            yAxisID: 'yOrders',
            pointRadius: 3,
            pointHoverRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'top' } },
        scales: {
          yRevenue: { type: 'linear', position: 'left', beginAtZero: true, ticks: { callback: v => `€${v}` } },
          yOrders: { type: 'linear', position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } }
        }
      }
    });
  }

  private renderStatusChart(raw: ChartData['statusBreakdown']): void {
    const colors: Record<string, string> = {
      pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6',
      delivered: '#10b981', cancelled: '#ef4444'
    };

    this.statusChart?.destroy();
    this.statusChart = new Chart(this.statusCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: raw.map(r => STATUS_LABELS[r.status] ?? r.status),
        datasets: [{
          data: raw.map(r => r.count),
          backgroundColor: raw.map(r => colors[r.status] ?? '#6b7280'),
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  private renderTopProductsChart(raw: ChartData['topProducts']): void {
    this.topProductsChart?.destroy();
    this.topProductsChart = new Chart(this.topProductsCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: raw.map(r => r.name.length > 20 ? r.name.slice(0, 20) + '…' : r.name),
        datasets: [{
          label: 'Τεμάχια πωλήθηκαν',
          data: raw.map(r => r.total_sold),
          backgroundColor: '#2563eb',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  private getLast30Days(): string[] {
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }
}
