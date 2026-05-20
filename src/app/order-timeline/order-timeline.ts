import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type OrderStatus = 'pending' | 'shipped' | 'delivered' | 'cancelled';

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
    // Define the order flow
    const statuses: OrderStatus[] = ['pending', 'shipped', 'delivered'];
    
    // Find current step index
    const currentIndex = statuses.indexOf(this.currentStatus);
    
    // If cancelled, show special state
    if (this.currentStatus === 'cancelled') {
      return this.getCancelledSteps();
    }
    
    // Build timeline steps
    return statuses.map((status, index) => ({
      label: this.getLabel(status),
      status: status,
      icon: this.getIcon(status, index <= currentIndex),
      completed: index < currentIndex,
      active: index === currentIndex
    }));
  }
  
  private getLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      'pending': 'Σε Επεξεργασία',
      'shipped': 'Αποστολή',
      'delivered': 'Παραδόθηκε',
      'cancelled': 'Ακυρώθηκε'
    };
    return labels[status];
  }
  
  private getIcon(status: OrderStatus, isActiveOrCompleted: boolean): string {
    if (!isActiveOrCompleted) return '○';
    
    const icons: Record<OrderStatus, string> = {
      'pending': '📝',
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