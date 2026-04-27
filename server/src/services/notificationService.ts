import { db } from '../db/database';
import { logDebug, logError } from './auditLog';
import {
  getActiveChannels,
  isEnabledForEvent,
  getAdminGlobalPref,
  isSmtpConfigured,
  ADMIN_SCOPED_EVENTS,
  type NotifEventType,
  type NotifChannel,
} from './notificationPreferencesService';
import {
  getEventText,
  sendEmail,
  sendWebhook,
  sendNtfy,
  getUserEmail,
  getUserLanguage,
  getUserWebhookUrl,
  getAdminWebhookUrl,
  getUserNtfyConfig,
  getAdminNtfyConfig,
  resolveNtfyUrl,
  getAppUrl,
} from './notifications';
import {
  resolveRecipients,
  createNotificationForRecipient,
  type NotificationInput,
} from './inAppNotifications';

// ── Event config map ───────────────────────────────────────────────────────

interface EventNotifConfig {
  inAppType: 'simple' | 'navigate';
  titleKey: string;
  textKey: string;
  navigateTextKey?: string;
  navigateTarget: (params: Record<string, string>) => string | null;
}

const EVENT_NOTIFICATION_CONFIG: Record<string, EventNotifConfig> = {
  // ── Dev-only test events ──────────────────────────────────────────────────
  test_simple: {
    inAppType: 'simple',
    titleKey: 'notif.test.title',
    textKey: 'notif.test.simple.text',
    navigateTarget: () => null,
  },
  test_boolean: {
    inAppType: 'simple', // overridden by inApp.type at call site
    titleKey: 'notif.test.title',
    textKey: 'notif.test.boolean.text',
    navigateTarget: () => null,
  },
  test_navigate: {
    inAppType: 'navigate',
    titleKey: 'notif.test.title',
    textKey: 'notif.test.navigate.text',
    navigateTextKey: 'notif.action.view',
    navigateTarget: () => '/dashboard',
  },
  // ── Production events ─────────────────────────────────────────────────────
  trip_invite: {
    inAppType: 'navigate',
    titleKey: 'notif.trip_invite.title',
    textKey: 'notif.trip_invite.text',
    navigateTextKey: 'notif.action.view_trip',
    navigateTarget: p => (p.tripId ? `/trips/${p.tripId}` : null),
  },
  booking_change: {
    inAppType: 'navigate',
    titleKey: 'notif.booking_change.title',
    textKey: 'notif.booking_change.text',
    navigateTextKey: 'notif.action.view_trip',
    navigateTarget: p => (p.tripId ? `/trips/${p.tripId}` : null),
  },
  trip_reminder: {
    inAppType: 'navigate',
    titleKey: 'notif.trip_reminder.title',
    textKey: 'notif.trip_reminder.text',
    navigateTextKey: 'notif.action.view_trip',
    navigateTarget: p => (p.tripId ? `/trips/${p.tripId}` : null),
  },
  todo_due: {
    inAppType: 'navigate',
    titleKey: 'notif.todo_due.title',
    textKey: 'notif.todo_due.text',
    navigateTextKey: 'notif.action.view_trip',
    navigateTarget: p => (p.tripId ? `/trips/${p.tripId}` : null),
  },
  vacay_invite: {
    inAppType: 'navigate',
    titleKey: 'notif.vacay_invite.title',
    textKey: 'notif.vacay_invite.text',
    navigateTextKey: 'notif.action.view_vacay',
    navigateTarget: p => (p.planId ? `/vacay/${p.planId}` : null),
  },
  photos_shared: {
    inAppType: 'navigate',
    titleKey: 'notif.photos_shared.title',
    textKey: 'notif.photos_shared.text',
    navigateTextKey: 'notif.action.view_trip',
    navigateTarget: p => (p.tripId ? `/trips/${p.tripId}` : null),
  },
  collab_message: {
    inAppType: 'navigate',
    titleKey: 'notif.collab_message.title',
    textKey: 'notif.collab_message.text',
    navigateTextKey: 'notif.action.view_collab',
    navigateTarget: p => (p.tripId ? `/trips/${p.tripId}` : null),
  },
  packing_tagged: {
    inAppType: 'navigate',
    titleKey: 'notif.packing_tagged.title',
    textKey: 'notif.packing_tagged.text',
    navigateTextKey: 'notif.action.view_packing',
    navigateTarget: p => (p.tripId ? `/trips/${p.tripId}` : null),
  },
  version_available: {
    inAppType: 'navigate',
    titleKey: 'notif.version_available.title',
    textKey: 'notif.version_available.text',
    navigateTextKey: 'notif.action.view_admin',
    navigateTarget: () => '/admin',
  },
  synology_session_cleared: {
    inAppType: 'simple',
    titleKey: 'notifications.synologySessionCleared.title',
    textKey: 'notifications.synologySessionCleared.text',
    navigateTarget: () => null,
  },
};

// ── Fallback config for unknown event types ────────────────────────────────

const FALLBACK_EVENT_CONFIG: EventNotifConfig = {
  inAppType: 'simple',
  titleKey: 'notif.generic.title',
  textKey: 'notif.generic.text',
  navigateTarget: () => null,
};

// ── Unified send() API ─────────────────────────────────────────────────────

export interface NotificationPayload {
  event: NotifEventType;
  actorId: number | null;
  params: Record<string, string>;
  scope: 'trip' | 'user' | 'admin';
  targetId: number; // tripId for trip scope, userId for user scope, 0 for admin
  /** Optional in-app overrides (e.g. boolean type with callbacks) */
  inApp?: {
    type?: 'simple' | 'boolean' | 'navigate';
    positiveTextKey?: string;
    negativeTextKey?: string;
    positiveCallback?: { action: string; payload: Record<string, unknown> };
    negativeCallback?: { action: string; payload: Record<string, unknown> };
    navigateTarget?: string; // override the auto-generated navigate target
  };
}

export async function send(payload: NotificationPayload): Promise<void> {
  const { event, actorId, params, scope, targetId, inApp } = payload;

  // Resolve recipients based on scope
  const recipients = resolveRecipients(scope, targetId, actorId);
  if (recipients.length === 0) return;

  const configEntry = EVENT_NOTIFICATION_CONFIG[event];
  if (!configEntry) {
    logDebug(`notificationService.send: unknown event type "${event}", using fallback`);
    if (process.env.NODE_ENV?.toLowerCase() === 'development' && actorId != null) {
      const devSender = (db.prepare('SELECT username, avatar FROM users WHERE id = ?').get(actorId) as { username: string; avatar: string | null } | undefined) ?? null;
      createNotificationForRecipient({
        type: 'simple',
        scope: 'user',
        target: actorId,
        sender_id: null,
        title_key: 'notif.dev.unknown_event.title',
        text_key: 'notif.dev.unknown_event.text',
        text_params: { event },
      }, actorId, devSender);
    }
  }
  const config = configEntry ?? FALLBACK_EVENT_CONFIG;
  const activeChannels = getActiveChannels();
  const appUrl = getAppUrl();

  // Build navigate target (used by email/webhook CTA and in-app navigate)
  const navigateTarget = inApp?.navigateTarget ?? config.navigateTarget(params);
  const fullLink = navigateTarget ? `${appUrl}${navigateTarget}` : undefined;

  // Fetch sender info once for in-app WS payloads
  const sender = actorId
    ? (db.prepare('SELECT username, avatar FROM users WHERE id = ?').get(actorId) as { username: string; avatar: string | null } | undefined) ?? null
    : null;

  logDebug(`notificationService.send event=${event} scope=${scope} targetId=${targetId} recipients=${recipients.length} channels=inapp,${activeChannels.join(',')}`);

  // Dispatch to each recipient in parallel
  await Promise.all(recipients.map(async (recipientId) => {
    const promises: Promise<unknown>[] = [];

    // ── In-app ──────────────────────────────────────────────────────────
    if (isEnabledForEvent(recipientId, event, 'inapp')) {
      const inAppType = inApp?.type ?? config.inAppType;
      let notifInput: NotificationInput;

      if (inAppType === 'boolean' && inApp?.positiveCallback && inApp?.negativeCallback) {
        notifInput = {
          type: 'boolean',
          scope,
          target: targetId,
          sender_id: actorId,
          event_type: event,
          title_key: config.titleKey,
          title_params: params,
          text_key: config.textKey,
          text_params: params,
          positive_text_key: inApp.positiveTextKey ?? 'notif.action.accept',
          negative_text_key: inApp.negativeTextKey ?? 'notif.action.decline',
          positive_callback: inApp.positiveCallback,
          negative_callback: inApp.negativeCallback,
        };
      } else if (inAppType === 'navigate' && navigateTarget) {
        notifInput = {
          type: 'navigate',
          scope,
          target: targetId,
          sender_id: actorId,
          event_type: event,
          title_key: config.titleKey,
          title_params: params,
          text_key: config.textKey,
          text_params: params,
          navigate_text_key: config.navigateTextKey ?? 'notif.action.view',
          navigate_target: navigateTarget,
        };
      } else {
        notifInput = {
          type: 'simple',
          scope,
          target: targetId,
          sender_id: actorId,
          event_type: event,
          title_key: config.titleKey,
          title_params: params,
          text_key: config.textKey,
          text_params: params,
        };
      }

      promises.push(
        Promise.resolve().then(() => createNotificationForRecipient(notifInput, recipientId, sender ?? null))
      );
    }

    // ── Email ────────────────────────────────────────────────────────────
    // Admin-scoped events: use global pref + SMTP check (bypass notification_channels toggle)
    // Regular events: use active channels + per-user pref
    const emailEnabled = ADMIN_SCOPED_EVENTS.has(event)
      ? isSmtpConfigured() && getAdminGlobalPref(event, 'email')
      : activeChannels.includes('email') && isEnabledForEvent(recipientId, event, 'email');

    if (emailEnabled) {
      const email = getUserEmail(recipientId);
      if (email) {
        const lang = getUserLanguage(recipientId);
        const { title, body } = getEventText(lang, event, params);
        promises.push(sendEmail(email, title, body, recipientId, navigateTarget ?? undefined));
      }
    }

    // ── Webhook (per-user) — skip for admin-scoped events (handled globally below) ──
    if (!ADMIN_SCOPED_EVENTS.has(event) && activeChannels.includes('webhook') && isEnabledForEvent(recipientId, event, 'webhook')) {
      const webhookUrl = getUserWebhookUrl(recipientId);
      if (webhookUrl) {
        const lang = getUserLanguage(recipientId);
        const { title, body } = getEventText(lang, event, params);
        promises.push(sendWebhook(webhookUrl, { event, title, body, tripName: params.trip, link: fullLink }));
      }
    }

    // ── Ntfy (per-user) — skip for admin-scoped events (handled globally below) ──
    if (!ADMIN_SCOPED_EVENTS.has(event) && activeChannels.includes('ntfy') && isEnabledForEvent(recipientId, event, 'ntfy' as NotifChannel)) {
      const userNtfyCfg = getUserNtfyConfig(recipientId);
      const adminNtfyCfg = getAdminNtfyConfig();
      const ntfyUrl = resolveNtfyUrl(adminNtfyCfg, userNtfyCfg);
      if (ntfyUrl) {
        const lang = getUserLanguage(recipientId);
        const { title, body } = getEventText(lang, event, params);
        const token = userNtfyCfg?.token ?? adminNtfyCfg.token;
        promises.push(sendNtfy(ntfyUrl, token, { event, title, body, link: fullLink }));
      }
    }

    const results = await Promise.allSettled(promises);
    for (const result of results) {
      if (result.status === 'rejected') {
        logError(`notificationService.send channel dispatch failed event=${event} recipient=${recipientId}: ${result.reason}`);
      }
    }
  }));

  // ── Admin webhook (scope: admin) — global, respects global pref ──────
  if (scope === 'admin' && getAdminGlobalPref(event, 'webhook')) {
    const adminWebhookUrl = getAdminWebhookUrl();
    if (adminWebhookUrl) {
      const { title, body } = getEventText('en', event, params);
      await sendWebhook(adminWebhookUrl, { event, title, body, link: fullLink }).catch((err: unknown) => {
        logError(`notificationService.send admin webhook failed event=${event}: ${err instanceof Error ? err.message : err}`);
      });
    }
  }

  // ── Admin ntfy (scope: admin) — global, respects global pref ─────────
  if (scope === 'admin' && getAdminGlobalPref(event, 'ntfy')) {
    const adminNtfyCfg = getAdminNtfyConfig();
    const adminNtfyUrl = resolveNtfyUrl(adminNtfyCfg, null);
    if (adminNtfyUrl) {
      const { title, body } = getEventText('en', event, params);
      await sendNtfy(adminNtfyUrl, adminNtfyCfg.token, { event, title, body, link: fullLink }).catch((err: unknown) => {
        logError(`notificationService.send admin ntfy failed event=${event}: ${err instanceof Error ? err.message : err}`);
      });
    }
  }
}
