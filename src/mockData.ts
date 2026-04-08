import { Alert, Device } from './types';

export const MOCK_ALERTS: Alert[] = [
  {
    id: '1',
    device_id: 'NODE-N-01',
    room: 'ZONE_204_MAIN',
    alert_type: 'Gunshot Discharge',
    confidence: 98.42,
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    severity: 'high',
  },
  {
    id: '2',
    device_id: 'NODE-E-03',
    room: 'ZONE_102_ENTRY',
    alert_type: 'Glass Fracture',
    confidence: 94.10,
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    severity: 'high',
  },
  {
    id: '3',
    device_id: 'NODE-S-02',
    room: 'ZONE_305_SOUTH',
    alert_type: 'Animal Vocalization',
    confidence: 88.25,
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    severity: 'medium',
  },
  {
    id: '4',
    device_id: 'NODE-W-04',
    room: 'ZONE_410_LOBBY',
    alert_type: 'Human Speech',
    confidence: 92.00,
    timestamp: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    severity: 'low',
  },
];

export const MOCK_DEVICES: Device[] = [
  {
    device_id: 'NODE-N-01',
    room: 'ZONE_204_MAIN',
    status: 'active',
    last_seen: new Date().toISOString(),
    recent_alerts: MOCK_ALERTS.filter(a => a.device_id === 'NODE-N-01'),
  },
  {
    device_id: 'NODE-E-03',
    room: 'ZONE_102_ENTRY',
    status: 'active',
    last_seen: new Date().toISOString(),
    recent_alerts: MOCK_ALERTS.filter(a => a.device_id === 'NODE-E-03'),
  },
  {
    device_id: 'NODE-S-02',
    room: 'ZONE_305_SOUTH',
    status: 'active',
    last_seen: new Date().toISOString(),
    recent_alerts: MOCK_ALERTS.filter(a => a.device_id === 'NODE-S-02'),
  },
  {
    device_id: 'NODE-W-04',
    room: 'ZONE_410_LOBBY',
    status: 'offline',
    last_seen: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    recent_alerts: MOCK_ALERTS.filter(a => a.device_id === 'NODE-W-04'),
  },
];
