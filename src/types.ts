export type Severity = 'low' | 'medium' | 'high';

export interface Alert {
  id: string;
  device_id: string;
  room: string;
  alert_type: string;
  confidence: number;
  timestamp: string;
  severity: Severity;
}

export interface Device {
  device_id: string;
  room: string;
  status: 'active' | 'offline';
  last_seen: string;
  recent_alerts: Alert[];
}

export interface DashboardStats {
  totalDevices: number;
  activeDevices: number;
  alertsLastHour: number;
  criticalAlertsCount: number;
}
