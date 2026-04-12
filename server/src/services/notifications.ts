import nodemailer from 'nodemailer';
import { db } from '../db/database';
import { decrypt_api_key } from './apiKeyCrypto';
import { logInfo, logDebug, logError } from './auditLog';
import { checkSsrf, createPinnedDispatcher } from '../utils/ssrfGuard';

// ── Types ──────────────────────────────────────────────────────────────────

import type { NotifEventType } from './notificationPreferencesService';

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

// ── HTML escaping ──────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Settings helpers ───────────────────────────────────────────────────────

function getAppSetting(key: string): string | null {
  return (db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined)?.value || null;
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST || getAppSetting('smtp_host');
  const port = process.env.SMTP_PORT || getAppSetting('smtp_port');
  const user = process.env.SMTP_USER || getAppSetting('smtp_user');
  const pass = process.env.SMTP_PASS || decrypt_api_key(getAppSetting('smtp_pass')) || '';
  const from = process.env.SMTP_FROM || getAppSetting('smtp_from');
  if (!host || !port || !from) return null;
  return { host, port: parseInt(port, 10), user: user || '', pass: pass || '', from, secure: parseInt(port, 10) === 465 };
}

// Exported for use by notificationService
export function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  const origins = process.env.ALLOWED_ORIGINS;
  if (origins) {
    const first = origins.split(',')[0]?.trim();
    if (first) return first.replace(/\/+$/, '');
  }
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}`;
}

export function getUserEmail(userId: number): string | null {
  return (db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined)?.email || null;
}

export function getUserLanguage(userId: number): string {
  return (db.prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'language'").get(userId) as { value: string } | undefined)?.value || 'en';
}

export function getUserWebhookUrl(userId: number): string | null {
  const value = (db.prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'webhook_url'").get(userId) as { value: string } | undefined)?.value || null;
  return value ? decrypt_api_key(value) : null;
}

export function getAdminWebhookUrl(): string | null {
  const value = getAppSetting('admin_webhook_url') || null;
  return value ? decrypt_api_key(value) : null;
}

// ── Email i18n strings ─────────────────────────────────────────────────────

interface EmailStrings { footer: string; manage: string; madeWith: string; openTrek: string }

const I18N: Record<string, EmailStrings> = {
  en: { footer: 'You received this because you have notifications enabled in TREK.', manage: 'Manage preferences in Settings', madeWith: 'Made with', openTrek: 'Open TREK' },
  de: { footer: 'Du erhältst diese E-Mail, weil du Benachrichtigungen in TREK aktiviert hast.', manage: 'Einstellungen verwalten', madeWith: 'Made with', openTrek: 'TREK öffnen' },
  fr: { footer: 'Vous recevez cet e-mail car les notifications sont activées dans TREK.', manage: 'Gérer les préférences', madeWith: 'Made with', openTrek: 'Ouvrir TREK' },
  es: { footer: 'Recibiste esto porque tienes las notificaciones activadas en TREK.', manage: 'Gestionar preferencias', madeWith: 'Made with', openTrek: 'Abrir TREK' },
  nl: { footer: 'Je ontvangt dit omdat je meldingen hebt ingeschakeld in TREK.', manage: 'Voorkeuren beheren', madeWith: 'Made with', openTrek: 'TREK openen' },
  ru: { footer: 'Вы получили это, потому что у вас включены уведомления в TREK.', manage: 'Управление настройками', madeWith: 'Made with', openTrek: 'Открыть TREK' },
  zh: { footer: '您收到此邮件是因为您在 TREK 中启用了通知。', manage: '管理偏好设置', madeWith: 'Made with', openTrek: '打开 TREK' },
  'zh-TW': { footer: '您收到這封郵件是因為您在 TREK 中啟用了通知。', manage: '管理偏好設定', madeWith: 'Made with', openTrek: '開啟 TREK' },
  ar: { footer: 'تلقيت هذا لأنك قمت بتفعيل الإشعارات في TREK.', manage: 'إدارة التفضيلات', madeWith: 'Made with', openTrek: 'فتح TREK' },
  id: { footer: 'Anda menerima ini karena Anda telah mengaktifkan notifikasi di TREK.', manage: 'Kelola preferensi di Pengaturan', madeWith: 'Dibuat dengan', openTrek: 'Buka TREK' },
};

// Translated notification texts per event type
interface EventText { title: string; body: string }
type EventTextFn = (params: Record<string, string>) => EventText

const EVENT_TEXTS: Record<string, Record<NotifEventType, EventTextFn>> = {
  en: {
    trip_invite: p => ({ title: `Trip invite: "${p.trip}"`, body: `${p.actor} invited ${p.invitee || 'a member'} to the trip "${p.trip}".` }),
    booking_change: p => ({ title: `New booking: ${p.booking}`, body: `${p.actor} added a new ${p.type} "${p.booking}" to "${p.trip}".` }),
    trip_reminder: p => ({ title: `Trip reminder: ${p.trip}`, body: `Your trip "${p.trip}" is coming up soon!` }),
    vacay_invite: p => ({ title: 'Vacay Fusion Invite', body: `${p.actor} invited you to fuse vacation plans. Open TREK to accept or decline.` }),
    photos_shared: p => ({ title: `${p.count} photos shared`, body: `${p.actor} shared ${p.count} photo(s) in "${p.trip}".` }),
    collab_message: p => ({ title: `New message in "${p.trip}"`, body: `${p.actor}: ${p.preview}` }),
    packing_tagged: p => ({ title: `Packing: ${p.category}`, body: `${p.actor} assigned you to the "${p.category}" packing category in "${p.trip}".` }),
    version_available: p => ({ title: 'New TREK version available', body: `TREK ${p.version} is now available. Visit the admin panel to update.` }),
    synology_session_cleared: () => ({ title: 'Synology session cleared', body: 'Your Synology account or URL changed. You have been logged out of Synology Photos.' }),
  },
  de: {
    trip_invite: p => ({ title: `Einladung zu "${p.trip}"`, body: `${p.actor} hat ${p.invitee || 'ein Mitglied'} zur Reise "${p.trip}" eingeladen.` }),
    booking_change: p => ({ title: `Neue Buchung: ${p.booking}`, body: `${p.actor} hat eine neue Buchung "${p.booking}" (${p.type}) zu "${p.trip}" hinzugefügt.` }),
    trip_reminder: p => ({ title: `Reiseerinnerung: ${p.trip}`, body: `Deine Reise "${p.trip}" steht bald an!` }),
    vacay_invite: p => ({ title: 'Vacay Fusion-Einladung', body: `${p.actor} hat dich eingeladen, Urlaubspläne zu fusionieren. Öffne TREK um anzunehmen oder abzulehnen.` }),
    photos_shared: p => ({ title: `${p.count} Fotos geteilt`, body: `${p.actor} hat ${p.count} Foto(s) in "${p.trip}" geteilt.` }),
    collab_message: p => ({ title: `Neue Nachricht in "${p.trip}"`, body: `${p.actor}: ${p.preview}` }),
    packing_tagged: p => ({ title: `Packliste: ${p.category}`, body: `${p.actor} hat dich der Kategorie "${p.category}" in der Packliste von "${p.trip}" zugewiesen.` }),
    version_available: p => ({ title: 'Neue TREK-Version verfügbar', body: `TREK ${p.version} ist jetzt verfügbar. Besuche das Admin-Panel zum Aktualisieren.` }),
    synology_session_cleared: () => ({ title: 'Synology-Sitzung beendet', body: 'Dein Synology-Konto oder die URL hat sich geändert. Du wurdest von Synology Photos abgemeldet.' }),
  },
  fr: {
    trip_invite: p => ({ title: `Invitation à "${p.trip}"`, body: `${p.actor} a invité ${p.invitee || 'un membre'} au voyage "${p.trip}".` }),
    booking_change: p => ({ title: `Nouvelle réservation : ${p.booking}`, body: `${p.actor} a ajouté une réservation "${p.booking}" (${p.type}) à "${p.trip}".` }),
    trip_reminder: p => ({ title: `Rappel de voyage : ${p.trip}`, body: `Votre voyage "${p.trip}" approche !` }),
    vacay_invite: p => ({ title: 'Invitation Vacay Fusion', body: `${p.actor} vous invite à fusionner les plans de vacances. Ouvrez TREK pour accepter ou refuser.` }),
    photos_shared: p => ({ title: `${p.count} photos partagées`, body: `${p.actor} a partagé ${p.count} photo(s) dans "${p.trip}".` }),
    collab_message: p => ({ title: `Nouveau message dans "${p.trip}"`, body: `${p.actor} : ${p.preview}` }),
    packing_tagged: p => ({ title: `Bagages : ${p.category}`, body: `${p.actor} vous a assigné à la catégorie "${p.category}" dans "${p.trip}".` }),
    version_available: p => ({ title: 'Nouvelle version TREK disponible', body: `TREK ${p.version} est maintenant disponible. Rendez-vous dans le panneau d'administration pour mettre à jour.` }),
    synology_session_cleared: () => ({ title: 'Session Synology effacée', body: 'Votre compte ou URL Synology a changé. Vous avez été déconnecté de Synology Photos.' }),
  },
  es: {
    trip_invite: p => ({ title: `Invitación a "${p.trip}"`, body: `${p.actor} invitó a ${p.invitee || 'un miembro'} al viaje "${p.trip}".` }),
    booking_change: p => ({ title: `Nueva reserva: ${p.booking}`, body: `${p.actor} añadió una reserva "${p.booking}" (${p.type}) a "${p.trip}".` }),
    trip_reminder: p => ({ title: `Recordatorio: ${p.trip}`, body: `¡Tu viaje "${p.trip}" se acerca!` }),
    vacay_invite: p => ({ title: 'Invitación Vacay Fusion', body: `${p.actor} te invitó a fusionar planes de vacaciones. Abre TREK para aceptar o rechazar.` }),
    photos_shared: p => ({ title: `${p.count} fotos compartidas`, body: `${p.actor} compartió ${p.count} foto(s) en "${p.trip}".` }),
    collab_message: p => ({ title: `Nuevo mensaje en "${p.trip}"`, body: `${p.actor}: ${p.preview}` }),
    packing_tagged: p => ({ title: `Equipaje: ${p.category}`, body: `${p.actor} te asignó a la categoría "${p.category}" en "${p.trip}".` }),
    version_available: p => ({ title: 'Nueva versión de TREK disponible', body: `TREK ${p.version} ya está disponible. Visita el panel de administración para actualizar.` }),
    synology_session_cleared: () => ({ title: 'Sesión de Synology cerrada', body: 'Tu cuenta o URL de Synology ha cambiado. Has cerrado sesión en Synology Photos.' }),
  },
  nl: {
    trip_invite: p => ({ title: `Uitnodiging voor "${p.trip}"`, body: `${p.actor} heeft ${p.invitee || 'een lid'} uitgenodigd voor de reis "${p.trip}".` }),
    booking_change: p => ({ title: `Nieuwe boeking: ${p.booking}`, body: `${p.actor} heeft een boeking "${p.booking}" (${p.type}) toegevoegd aan "${p.trip}".` }),
    trip_reminder: p => ({ title: `Reisherinnering: ${p.trip}`, body: `Je reis "${p.trip}" komt eraan!` }),
    vacay_invite: p => ({ title: 'Vacay Fusion uitnodiging', body: `${p.actor} nodigt je uit om vakantieplannen te fuseren. Open TREK om te accepteren of af te wijzen.` }),
    photos_shared: p => ({ title: `${p.count} foto's gedeeld`, body: `${p.actor} heeft ${p.count} foto('s) gedeeld in "${p.trip}".` }),
    collab_message: p => ({ title: `Nieuw bericht in "${p.trip}"`, body: `${p.actor}: ${p.preview}` }),
    packing_tagged: p => ({ title: `Paklijst: ${p.category}`, body: `${p.actor} heeft je toegewezen aan de categorie "${p.category}" in "${p.trip}".` }),
    version_available: p => ({ title: 'Nieuwe TREK-versie beschikbaar', body: `TREK ${p.version} is nu beschikbaar. Bezoek het beheerderspaneel om bij te werken.` }),
    synology_session_cleared: () => ({ title: 'Synology-sessie gewist', body: 'Je Synology-account of URL is gewijzigd. Je bent uitgelogd bij Synology Photos.' }),
  },
  ru: {
    trip_invite: p => ({ title: `Приглашение в "${p.trip}"`, body: `${p.actor} пригласил ${p.invitee || 'участника'} в поездку "${p.trip}".` }),
    booking_change: p => ({ title: `Новое бронирование: ${p.booking}`, body: `${p.actor} добавил бронирование "${p.booking}" (${p.type}) в "${p.trip}".` }),
    trip_reminder: p => ({ title: `Напоминание: ${p.trip}`, body: `Ваша поездка "${p.trip}" скоро начнётся!` }),
    vacay_invite: p => ({ title: 'Приглашение Vacay Fusion', body: `${p.actor} приглашает вас объединить планы отпуска. Откройте TREK для подтверждения.` }),
    photos_shared: p => ({ title: `${p.count} фото`, body: `${p.actor} поделился ${p.count} фото в "${p.trip}".` }),
    collab_message: p => ({ title: `Новое сообщение в "${p.trip}"`, body: `${p.actor}: ${p.preview}` }),
    packing_tagged: p => ({ title: `Список вещей: ${p.category}`, body: `${p.actor} назначил вас в категорию "${p.category}" в "${p.trip}".` }),
    version_available: p => ({ title: 'Доступна новая версия TREK', body: `TREK ${p.version} теперь доступен. Перейдите в панель администратора для обновления.` }),
    synology_session_cleared: () => ({ title: 'Сессия Synology сброшена', body: 'Ваш аккаунт или URL Synology изменился. Вы вышли из Synology Photos.' }),
  },
  zh: {
    trip_invite: p => ({ title: `邀请加入"${p.trip}"`, body: `${p.actor} 邀请了 ${p.invitee || '成员'} 加入旅行"${p.trip}"。` }),
    booking_change: p => ({ title: `新预订：${p.booking}`, body: `${p.actor} 在"${p.trip}"中添加了预订"${p.booking}"（${p.type}）。` }),
    trip_reminder: p => ({ title: `旅行提醒：${p.trip}`, body: `你的旅行"${p.trip}"即将开始！` }),
    vacay_invite: p => ({ title: 'Vacay 融合邀请', body: `${p.actor} 邀请你合并假期计划。打开 TREK 接受或拒绝。` }),
    photos_shared: p => ({ title: `${p.count} 张照片已分享`, body: `${p.actor} 在"${p.trip}"中分享了 ${p.count} 张照片。` }),
    collab_message: p => ({ title: `"${p.trip}"中的新消息`, body: `${p.actor}：${p.preview}` }),
    packing_tagged: p => ({ title: `行李清单：${p.category}`, body: `${p.actor} 将你分配到"${p.trip}"中的"${p.category}"类别。` }),
    version_available: p => ({ title: '新版 TREK 可用', body: `TREK ${p.version} 现已可用。请前往管理面板进行更新。` }),
    synology_session_cleared: () => ({ title: 'Synology 会话已清除', body: '您的 Synology 账户或 URL 已更改，您已退出 Synology Photos。' }),
  },
  'zh-TW': {
    trip_invite: p => ({ title: `邀請加入「${p.trip}」`, body: `${p.actor} 邀請了 ${p.invitee || '成員'} 加入行程「${p.trip}」。` }),
    booking_change: p => ({ title: `新預訂：${p.booking}`, body: `${p.actor} 在「${p.trip}」中新增了預訂「${p.booking}」（${p.type}）。` }),
    trip_reminder: p => ({ title: `行程提醒：${p.trip}`, body: `您的行程「${p.trip}」即將開始！` }),
    vacay_invite: p => ({ title: 'Vacay 融合邀請', body: `${p.actor} 邀請您合併假期計畫。開啟 TREK 以接受或拒絕。` }),
    photos_shared: p => ({ title: `已分享 ${p.count} 張照片`, body: `${p.actor} 在「${p.trip}」中分享了 ${p.count} 張照片。` }),
    collab_message: p => ({ title: `「${p.trip}」中的新訊息`, body: `${p.actor}：${p.preview}` }),
    packing_tagged: p => ({ title: `打包清單：${p.category}`, body: `${p.actor} 已將您指派到「${p.trip}」中的「${p.category}」分類。` }),
    version_available: p => ({ title: '新版 TREK 可用', body: `TREK ${p.version} 現已可用。請前往管理面板進行更新。` }),
    synology_session_cleared: () => ({ title: 'Synology 工作階段已清除', body: '您的 Synology 帳戶或 URL 已變更，您已登出 Synology Photos。' }),
  },
  ar: {
    trip_invite: p => ({ title: `دعوة إلى "${p.trip}"`, body: `${p.actor} دعا ${p.invitee || 'عضو'} إلى الرحلة "${p.trip}".` }),
    booking_change: p => ({ title: `حجز جديد: ${p.booking}`, body: `${p.actor} أضاف حجز "${p.booking}" (${p.type}) إلى "${p.trip}".` }),
    trip_reminder: p => ({ title: `تذكير: ${p.trip}`, body: `رحلتك "${p.trip}" تقترب!` }),
    vacay_invite: p => ({ title: 'دعوة دمج الإجازة', body: `${p.actor} يدعوك لدمج خطط الإجازة. افتح TREK للقبول أو الرفض.` }),
    photos_shared: p => ({ title: `${p.count} صور مشتركة`, body: `${p.actor} شارك ${p.count} صورة في "${p.trip}".` }),
    collab_message: p => ({ title: `رسالة جديدة في "${p.trip}"`, body: `${p.actor}: ${p.preview}` }),
    packing_tagged: p => ({ title: `قائمة التعبئة: ${p.category}`, body: `${p.actor} عيّنك في فئة "${p.category}" في "${p.trip}".` }),
    version_available: p => ({ title: 'إصدار TREK جديد متاح', body: `TREK ${p.version} متاح الآن. تفضل بزيارة لوحة الإدارة للتحديث.` }),
    synology_session_cleared: () => ({ title: 'تمت إعادة تعيين جلسة Synology', body: 'تغيّر حسابك أو رابط Synology. تم تسجيل خروجك من Synology Photos.' }),
  },
  br: {
    trip_invite: p => ({ title: `Convite para "${p.trip}"`, body: `${p.actor} convidou ${p.invitee || 'um membro'} para a viagem "${p.trip}".` }),
    booking_change: p => ({ title: `Nova reserva: ${p.booking}`, body: `${p.actor} adicionou uma reserva "${p.booking}" (${p.type}) em "${p.trip}".` }),
    trip_reminder: p => ({ title: `Lembrete: ${p.trip}`, body: `Sua viagem "${p.trip}" está chegando!` }),
    vacay_invite: p => ({ title: 'Convite Vacay Fusion', body: `${p.actor} convidou você para fundir planos de férias. Abra o TREK para aceitar ou recusar.` }),
    photos_shared: p => ({ title: `${p.count} fotos compartilhadas`, body: `${p.actor} compartilhou ${p.count} foto(s) em "${p.trip}".` }),
    collab_message: p => ({ title: `Nova mensagem em "${p.trip}"`, body: `${p.actor}: ${p.preview}` }),
    packing_tagged: p => ({ title: `Bagagem: ${p.category}`, body: `${p.actor} atribuiu você à categoria "${p.category}" em "${p.trip}".` }),
    version_available: p => ({ title: 'Nova versão do TREK disponível', body: `O TREK ${p.version} está disponível. Acesse o painel de administração para atualizar.` }),
    synology_session_cleared: () => ({ title: 'Sessão Synology encerrada', body: 'Sua conta ou URL do Synology foi alterada. Você foi desconectado do Synology Photos.' }),
  },
  cs: {
    trip_invite: p => ({ title: `Pozvánka do "${p.trip}"`, body: `${p.actor} pozval ${p.invitee || 'člena'} na výlet "${p.trip}".` }),
    booking_change: p => ({ title: `Nová rezervace: ${p.booking}`, body: `${p.actor} přidal rezervaci "${p.booking}" (${p.type}) k "${p.trip}".` }),
    trip_reminder: p => ({ title: `Připomínka výletu: ${p.trip}`, body: `Váš výlet "${p.trip}" se blíží!` }),
    vacay_invite: p => ({ title: 'Pozvánka Vacay Fusion', body: `${p.actor} vás pozval ke spojení dovolenkových plánů. Otevřete TREK pro přijetí nebo odmítnutí.` }),
    photos_shared: p => ({ title: `${p.count} sdílených fotek`, body: `${p.actor} sdílel ${p.count} foto v "${p.trip}".` }),
    collab_message: p => ({ title: `Nová zpráva v "${p.trip}"`, body: `${p.actor}: ${p.preview}` }),
    packing_tagged: p => ({ title: `Balení: ${p.category}`, body: `${p.actor} vás přiřadil do kategorie "${p.category}" v "${p.trip}".` }),
    version_available: p => ({ title: 'Nová verze TREK dostupná', body: `TREK ${p.version} je nyní dostupný. Navštivte administrátorský panel pro aktualizaci.` }),
    synology_session_cleared: () => ({ title: 'Relace Synology byla zrušena', body: 'Váš účet nebo URL Synology se změnil. Byli jste odhlášeni ze Synology Photos.' }),
  },
  hu: {
    trip_invite: p => ({ title: `Meghívó a(z) "${p.trip}" utazásra`, body: `${p.actor} meghívta ${p.invitee || 'egy tagot'} a(z) "${p.trip}" utazásra.` }),
    booking_change: p => ({ title: `Új foglalás: ${p.booking}`, body: `${p.actor} hozzáadott egy "${p.booking}" (${p.type}) foglalást a(z) "${p.trip}" utazáshoz.` }),
    trip_reminder: p => ({ title: `Utazás emlékeztető: ${p.trip}`, body: `A(z) "${p.trip}" utazás hamarosan kezdődik!` }),
    vacay_invite: p => ({ title: 'Vacay Fusion meghívó', body: `${p.actor} meghívott a nyaralási tervek összevonásához. Nyissa meg a TREK-et az elfogadáshoz vagy elutasításhoz.` }),
    photos_shared: p => ({ title: `${p.count} fotó megosztva`, body: `${p.actor} ${p.count} fotót osztott meg a(z) "${p.trip}" utazásban.` }),
    collab_message: p => ({ title: `Új üzenet a(z) "${p.trip}" utazásban`, body: `${p.actor}: ${p.preview}` }),
    packing_tagged: p => ({ title: `Csomagolás: ${p.category}`, body: `${p.actor} hozzárendelte Önt a "${p.category}" csomagolási kategóriához a(z) "${p.trip}" utazásban.` }),
    version_available: p => ({ title: 'Új TREK verzió érhető el', body: `A TREK ${p.version} elérhető. Látogasson el az adminisztrációs panelre a frissítéshez.` }),
    synology_session_cleared: () => ({ title: 'Synology munkamenet törölve', body: 'A Synology fiókja vagy URL-je megváltozott. Kijelentkeztek a Synology Photos-ból.' }),
  },
  it: {
    trip_invite: p => ({ title: `Invito a "${p.trip}"`, body: `${p.actor} ha invitato ${p.invitee || 'un membro'} al viaggio "${p.trip}".` }),
    booking_change: p => ({ title: `Nuova prenotazione: ${p.booking}`, body: `${p.actor} ha aggiunto una prenotazione "${p.booking}" (${p.type}) a "${p.trip}".` }),
    trip_reminder: p => ({ title: `Promemoria viaggio: ${p.trip}`, body: `Il tuo viaggio "${p.trip}" si avvicina!` }),
    vacay_invite: p => ({ title: 'Invito Vacay Fusion', body: `${p.actor} ti ha invitato a fondere i piani vacanza. Apri TREK per accettare o rifiutare.` }),
    photos_shared: p => ({ title: `${p.count} foto condivise`, body: `${p.actor} ha condiviso ${p.count} foto in "${p.trip}".` }),
    collab_message: p => ({ title: `Nuovo messaggio in "${p.trip}"`, body: `${p.actor}: ${p.preview}` }),
    packing_tagged: p => ({ title: `Bagagli: ${p.category}`, body: `${p.actor} ti ha assegnato alla categoria "${p.category}" in "${p.trip}".` }),
    version_available: p => ({ title: 'Nuova versione TREK disponibile', body: `TREK ${p.version} è ora disponibile. Visita il pannello di amministrazione per aggiornare.` }),
    synology_session_cleared: () => ({ title: 'Sessione Synology rimossa', body: 'Il tuo account o URL Synology è cambiato. Sei stato disconnesso da Synology Photos.' }),
  },
  pl: {
    trip_invite: p => ({ title: `Zaproszenie do "${p.trip}"`, body: `${p.actor} zaprosił ${p.invitee || 'członka'} do podróży "${p.trip}".` }),
    booking_change: p => ({ title: `Nowa rezerwacja: ${p.booking}`, body: `${p.actor} dodał rezerwację "${p.booking}" (${p.type}) do "${p.trip}".` }),
    trip_reminder: p => ({ title: `Przypomnienie o podróży: ${p.trip}`, body: `Twoja podróż "${p.trip}" zbliża się!` }),
    vacay_invite: p => ({ title: 'Zaproszenie Vacay Fusion', body: `${p.actor} zaprosił Cię do połączenia planów urlopowych. Otwórz TREK, aby zaakceptować lub odrzucić.` }),
    photos_shared: p => ({ title: `${p.count} zdjęć udostępnionych`, body: `${p.actor} udostępnił ${p.count} zdjęcie/zdjęcia w "${p.trip}".` }),
    collab_message: p => ({ title: `Nowa wiadomość w "${p.trip}"`, body: `${p.actor}: ${p.preview}` }),
    packing_tagged: p => ({ title: `Pakowanie: ${p.category}`, body: `${p.actor} przypisał Cię do kategorii "${p.category}" w "${p.trip}".` }),
    version_available: p => ({ title: 'Nowa wersja TREK dostępna', body: `TREK ${p.version} jest teraz dostępny. Odwiedź panel administracyjny, aby zaktualizować.` }),
    synology_session_cleared: () => ({ title: 'Sesja Synology wyczyszczona', body: 'Twoje konto lub URL Synology uległo zmianie. Zostałeś wylogowany z Synology Photos.' }),
  },
  id: {
    trip_invite: p => ({ title: `Undangan perjalanan: "${p.trip}"`, body: `${p.actor} mengundang ${p.invitee || 'seorang anggota'} ke perjalanan "${p.trip}".` }),
    booking_change: p => ({ title: `Pemesanan baru: ${p.booking}`, body: `${p.actor} menambahkan "${p.booking}" (${p.type}) baru ke "${p.trip}".` }),
    trip_reminder: p => ({ title: `Pengingat perjalanan: ${p.trip}`, body: `Perjalanan Anda "${p.trip}" akan segera tiba!` }),
    vacay_invite: p => ({ title: 'Undangan Penggabungan Vacay', body: `${p.actor} mengundang Anda untuk menggabungkan rencana liburan. Buka TREK untuk menerima atau menolak.` }),
    photos_shared: p => ({ title: `${p.count} foto dibagikan`, body: `${p.actor} membagikan ${p.count} foto di "${p.trip}".` }),
    collab_message: p => ({ title: `Pesan baru di "${p.trip}"`, body: `${p.actor}: ${p.preview}` }),
    packing_tagged: p => ({ title: `Pengepakan: ${p.category}`, body: `${p.actor} menugaskan Anda ke kategori "${p.category}" di "${p.trip}".` }),
    version_available: p => ({ title: 'Versi TREK baru tersedia', body: `TREK ${p.version} sekarang tersedia. Kunjungi panel admin untuk memperbarui.` }),
  },
};

// Get localized event text
export function getEventText(lang: string, event: NotifEventType, params: Record<string, string>): EventText {
  const texts = EVENT_TEXTS[lang] || EVENT_TEXTS.en;
  const fn = texts[event] ?? EVENT_TEXTS.en[event];
  if (!fn) return { title: event, body: '' };
  return fn(params);
}

// ── Email HTML builder ─────────────────────────────────────────────────────

export function buildEmailHtml(subject: string, body: string, lang: string, navigateTarget?: string): string {
  const s = I18N[lang] || I18N.en;
  const appUrl = getAppUrl();
  const ctaHref = escapeHtml(navigateTarget ? `${appUrl}${navigateTarget}` : (appUrl || ''));
  const safeSubject = escapeHtml(subject);
  const safeBody = escapeHtml(body);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr><td style="background: linear-gradient(135deg, #000000 0%, #1a1a2e 100%); padding: 32px 32px 28px; text-align: center;">
          <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj4NCiAgPGRlZnM+DQogICAgPGxpbmVhckdyYWRpZW50IGlkPSJiZyIgeDE9IjAiIHkxPSIwIiB4Mj0iMSIgeTI9IjEiPg0KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzFlMjkzYiIvPg0KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjMGYxNzJhIi8+DQogICAgPC9saW5lYXJHcmFkaWVudD4NCiAgICA8Y2xpcFBhdGggaWQ9Imljb24iPg0KICAgICAgPHBhdGggZD0iTSA4NTUuNjM2NzE5IDY5OS4yMDMxMjUgTCAyMjIuMjQ2MDk0IDY5OS4yMDMxMjUgQyAxOTcuNjc5Njg4IDY5OS4yMDMxMjUgMTc5LjkwNjI1IDY3NS43NSAxODYuNTM5MDYyIDY1Mi4xMDE1NjIgTCAzNjAuNDI5Njg4IDMyLjM5MDYyNSBDIDM2NC45MjE4NzUgMTYuMzg2NzE5IDM3OS41MTE3MTkgNS4zMjgxMjUgMzk2LjEzMjgxMiA1LjMyODEyNSBMIDEwMjkuNTI3MzQ0IDUuMzI4MTI1IEMgMTA1NC4wODk4NDQgNS4zMjgxMjUgMTA3MS44NjcxODggMjguNzc3MzQ0IDEwNjUuMjMwNDY5IDUyLjQyOTY4OCBMIDg5MS4zMzk4NDQgNjcyLjEzNjcxOSBDIDg4Ni44NTE1NjIgNjg4LjE0MDYyNSA4NzIuMjU3ODEyIDY5OS4yMDMxMjUgODU1LjYzNjcxOSA2OTkuMjAzMTI1IFogTSA0NDQuMjM4MjgxIDExNjYuOTgwNDY5IEwgNTMzLjc3MzQzOCA4NDcuODk4NDM4IEMgNTQwLjQxMDE1NiA4MjQuMjQ2MDk0IDUyMi42MzI4MTIgODAwLjc5Njg3NSA0OTguMDcwMzEyIDgwMC43OTY4NzUgTCAxNzIuNDcyNjU2IDgwMC43OTY4NzUgQyAxNTUuODUxNTYyIDgwMC43OTY4NzUgMTQxLjI2MTcxOSA4MTEuODU1NDY5IDEzNi43Njk1MzEgODI3Ljg1OTM3NSBMIDQ3LjIzNDM3NSAxMTQ2Ljk0MTQwNiBDIDQwLjU5NzY1NiAxMTcwLjU5Mzc1IDU4LjM3NSAxMTk0LjA0Mjk2OSA4Mi45Mzc1IDExOTQuMDQyOTY5IEwgNDA4LjUzNTE1NiAxMTk0LjA0Mjk2OSBDIDQyNS4xNTYyNSAxMTk0LjA0Mjk2OSA0MzkuNzUgMTE4Mi45ODQzNzUgNDQ0LjIzODI4MSAxMTY2Ljk4MDQ2OSBaIE0gNjA5LjAwMzkwNiA4MjcuODU5Mzc1IEwgNDM1LjExMzI4MSAxNDQ3LjU3MDMxMiBDIDQyOC40NzY1NjIgMTQ3MS4yMTg3NSA0NDYuMjUzOTA2IDE0OTQuNjcxODc1IDQ3MC44MTY0MDYgMTQ5NC42NzE4NzUgTCAxMTA0LjIxMDkzOCAxNDk0LjY3MTg3NSBDIDExMjAuODMyMDMxIDE0OTQuNjcxODc1IDExMzUuNDIxODc1IDE0ODMuNjA5Mzc1IDExMzkuOTE0MDYyIDE0NjcuNjA1NDY5IEwgMTMxMy44MDQ2ODggODQ3Ljg5ODQzOCBDIDEzMjAuNDQxNDA2IDgyNC4yNDYwOTQgMTMwMi42NjQwNjIgODAwLjc5Njg3NSAxMjc4LjEwMTU2MiA4MDAuNzk2ODc1IEwgNjQ0LjcwNzAzMSA4MDAuNzk2ODc1IEMgNjI4LjA4NTkzOCA4MDAuNzk2ODc1IDYxMy40OTIxODggODExLjg1NTQ2OSA2MDkuMDAzOTA2IDgyNy44NTkzNzUgWiBNIDEwNTYuMTA1NDY5IDMzMy4wMTk1MzEgTCA5NjYuNTcwMzEyIDY1Mi4xMDE1NjIgQyA5NTkuOTMzNTk0IDY3NS43NSA5NzcuNzEwOTM4IDY5OS4yMDMxMjUgMTAwMi4yNzM0MzggNjk5LjIwMzEyNSBMIDEzMjcuODcxMDk0IDY5OS4yMDMxMjUgQyAxMzQ0LjQ5MjE4OCA2OTkuMjAzMTI1IDEzNTkuMDg1OTM4IDY4OC4xNDA2MjUgMTM2My41NzQyMTkgNjcyLjEzNjcxOSBMIDE0NTMuMTA5Mzc1IDM1My4wNTQ2ODggQyAxNDU5Ljc0NjA5NCAzMjkuNDA2MjUgMTQ0MS45Njg3NSAzMDUuOTUzMTI1IDE0MTcuNDA2MjUgMzA1Ljk1MzEyNSBMIDEwOTEuODA4NTk0IDMwNS45NTMxMjUgQyAxMDc1LjE4NzUgMzA1Ljk1MzEyNSAxMDYwLjU5NzY1NiAzMTcuMDE1NjI1IDEwNTYuMTA1NDY5IDMzMy4wMTk1MzEgWiIvPg0KICAgIDwvY2xpcFBhdGg+DQogIDwvZGVmcz4NCiAgPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIGZpbGw9InVybCgjYmcpIi8+DQogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDU2LDUxKSBzY2FsZSgwLjI2NykiPg0KICAgIDxyZWN0IHdpZHRoPSIxNTAwIiBoZWlnaHQ9IjE1MDAiIGZpbGw9IiNmZmZmZmYiIGNsaXAtcGF0aD0idXJsKCNpY29uKSIvPg0KICA8L2c+DQo8L3N2Zz4NCg==" alt="TREK" width="48" height="48" style="border-radius: 14px; margin-bottom: 14px; display: block; margin-left: auto; margin-right: auto;" />
          <div style="color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">TREK</div>
          <div style="color: rgba(255,255,255,0.4); font-size: 10px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px;">Travel Resource &amp; Exploration Kit</div>
        </td></tr>
        <!-- Content -->
        <tr><td style="padding: 32px 32px 16px;">
          <h1 style="margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #111827; line-height: 1.3;">${safeSubject}</h1>
          <div style="width: 32px; height: 3px; background: #111827; border-radius: 2px; margin-bottom: 20px;"></div>
          <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.7; white-space: pre-wrap;">${safeBody}</p>
        </td></tr>
        <!-- CTA -->
        ${appUrl ? `<tr><td style="padding: 8px 32px 32px; text-align: center;">
          <a href="${ctaHref}" style="display: inline-block; padding: 12px 28px; background: #111827; color: #ffffff; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 10px; letter-spacing: 0.2px;">${s.openTrek}</a>
        </td></tr>` : ''}
        <!-- Footer -->
        <tr><td style="padding: 20px 32px; background: #f9fafb; border-top: 1px solid #f3f4f6; text-align: center;">
          <p style="margin: 0 0 8px; font-size: 11px; color: #9ca3af; line-height: 1.5;">${s.footer}<br>${s.manage}</p>
          <p style="margin: 0; font-size: 10px; color: #d1d5db;">${s.madeWith} <span style="color: #ef4444;">&hearts;</span> by Maurice &middot; <a href="https://github.com/mauriceboe/TREK" style="color: #9ca3af; text-decoration: none;">GitHub</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Send functions ─────────────────────────────────────────────────────────

export async function sendEmail(to: string, subject: string, body: string, userId?: number, navigateTarget?: string): Promise<boolean> {
  const config = getSmtpConfig();
  if (!config) return false;

  const lang = userId ? getUserLanguage(userId) : 'en';

  try {
    const skipTls = process.env.SMTP_SKIP_TLS_VERIFY === 'true' || getAppSetting('smtp_skip_tls_verify') === 'true';
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      ...(skipTls ? { tls: { rejectUnauthorized: false } } : {}),
    });

    await transporter.sendMail({
      from: config.from,
      to,
      subject: `TREK — ${subject}`,
      text: body,
      html: buildEmailHtml(subject, body, lang, navigateTarget),
    });
    logInfo(`Email sent to=${to} subject="${subject}"`);
    logDebug(`Email smtp=${config.host}:${config.port} from=${config.from} to=${to}`);
    return true;
  } catch (err) {
    logError(`Email send failed to=${to}: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

export function buildWebhookBody(url: string, payload: { event: string; title: string; body: string; tripName?: string; link?: string }): string {
  const isDiscord = /discord(?:app)?\.com\/api\/webhooks\//.test(url);
  const isSlack = /hooks\.slack\.com\//.test(url);

  if (isDiscord) {
    return JSON.stringify({
      embeds: [{
        title: `📍 ${payload.title}`,
        description: payload.body,
        url: payload.link,
        color: 0x3b82f6,
        footer: { text: payload.tripName ? `Trip: ${payload.tripName}` : 'TREK' },
        timestamp: new Date().toISOString(),
      }],
    });
  }

  if (isSlack) {
    const trip = payload.tripName ? `  •  _${payload.tripName}_` : '';
    const link = payload.link ? `\n<${payload.link}|Open in TREK>` : '';
    return JSON.stringify({
      text: `*${payload.title}*\n${payload.body}${trip}${link}`,
    });
  }

  return JSON.stringify({ ...payload, timestamp: new Date().toISOString(), source: 'TREK' });
}

export async function sendWebhook(url: string, payload: { event: string; title: string; body: string; tripName?: string; link?: string }): Promise<boolean> {
  if (!url) return false;

  const ssrf = await checkSsrf(url);
  if (!ssrf.allowed) {
    logError(`Webhook blocked by SSRF guard event=${payload.event} url=${url} reason=${ssrf.error}`);
    return false;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: buildWebhookBody(url, payload),
      signal: AbortSignal.timeout(10000),
      dispatcher: createPinnedDispatcher(ssrf.resolvedIp!),
    } as any);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      logError(`Webhook HTTP ${res.status}: ${errBody}`);
      return false;
    }

    logInfo(`Webhook sent event=${payload.event} trip=${payload.tripName || '-'}`);
    logDebug(`Webhook url=${url} payload=${buildWebhookBody(url, payload).substring(0, 500)}`);
    return true;
  } catch (err) {
    logError(`Webhook failed event=${payload.event}: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

export async function testSmtp(to: string): Promise<{ success: boolean; error?: string }> {
  try {
    const sent = await sendEmail(to, 'Test Notification', 'This is a test email from TREK. If you received this, your SMTP configuration is working correctly.');
    return sent ? { success: true } : { success: false, error: 'SMTP not configured' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function testWebhook(url: string): Promise<{ success: boolean; error?: string }> {
  try {
    const sent = await sendWebhook(url, { event: 'test', title: 'Test Notification', body: 'This is a test webhook from TREK. If you received this, your webhook configuration is working correctly.' });
    return sent ? { success: true } : { success: false, error: 'Failed to send webhook' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

