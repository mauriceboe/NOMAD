export type Display  = 'modal' | 'banner' | 'toast';
export type Severity = 'info'  | 'warn'   | 'critical';

export type NoticeCondition =
  | { kind: 'firstLogin' }
  | { kind: 'always' }
  | { kind: 'noTrips' }
  | { kind: 'existingUserBeforeVersion'; version: string }
  | { kind: 'dateWindow'; startsAt: string; endsAt?: string }
  | { kind: 'role'; roles: Array<'admin' | 'user'> }
  | { kind: 'addonEnabled'; addonId: string }
  | { kind: 'custom'; id: string };

export interface NoticeMedia {
  src: string;
  srcDark?: string;
  altKey: string;
  placement?: 'hero' | 'inline';
  aspectRatio?: string;
}

export type NoticeCta =
  | { kind: 'nav';    labelKey: string; href: string }
  | { kind: 'action'; labelKey: string; actionId: string; dismissOnAction?: boolean };

export interface SystemNotice {
  id: string;
  display: Display;
  severity: Severity;
  titleKey: string;
  bodyKey: string;
  bodyParams?: Record<string, string>;
  icon?: string;
  media?: NoticeMedia;
  highlights?: Array<{ labelKey: string; iconName?: string }>;
  cta?: NoticeCta;
  dismissible: boolean;
  conditions: NoticeCondition[];
  publishedAt: string;
  minVersion?: string;
  maxVersion?: string;
  priority?: number;
}

// DTO sent to client (same shape minus the conditions — server evaluates those)
export type SystemNoticeDTO = Omit<SystemNotice, 'conditions' | 'publishedAt' | 'minVersion' | 'maxVersion' | 'priority'>;
