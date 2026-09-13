import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { statusLabel } from '../services/order-status.util';

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

interface TimelineStep {
  label: string;
  status: OrderStatus;
  icon: string;
  completed: boolean;
  active: boolean;
}

@Component({
  selector: 'app-order-timeline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-timeline.html',
  styleUrl: './order-timeline.css'
})
export class OrderTimelineComponent {
  
  @Input() currentStatus: OrderStatus = 'pending';
  
  get steps(): TimelineStep[] {
    const statuses: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered'];
    const currentIndex = statuses.indexOf(this.currentStatus);

    if (this.currentStatus === 'cancelled') {
      return this.getCancelledSteps();
    }

    return statuses.map((status, index) => ({
      label: statusLabel(status),
      status: status,
      icon: this.getIcon(status, index <= currentIndex),
      completed: index < currentIndex,
      active: index === currentIndex
    }));
  }


  private getIcon(status: OrderStatus, isActiveOrCompleted: boolean): string {
    if (!isActiveOrCompleted) return '○';
    
    const icons: Record<OrderStatus, string> = {
      'pending': '📝',
      'processing': '⚙️',
      'shipped': '🚚',
      'delivered': '✓',
      'cancelled': '✕'
    };
    return icons[status];
  }
  
  private getCancelledSteps(): TimelineStep[] {
    return [
      {
        label: 'Παραγγελία',
        status: 'pending',
        icon: '✓',
        completed: true,
        active: false
      },
      {
        label: 'Ακυρώθηκε',
        status: 'cancelled',
        icon: '✕',
        completed: false,
        active: true
      }
    ];
  }
}