# Languages

TREK ships with translations for 15 languages. You can change your language at any time without logging out.

## Supported languages

| Code | Language |
|------|----------|
| `de` | Deutsch |
| `en` | English |
| `es` | Español |
| `fr` | Français |
| `hu` | Magyar |
| `nl` | Nederlands |
| `br` | Português (Brasil) |
| `cs` | Česky |
| `pl` | Polski |
| `ru` | Русский |
| `zh` | 简体中文 |
| `zh-TW` | 繁體中文 |
| `it` | Italiano |
| `ar` | العربية |
| `id` | Bahasa Indonesia |

## RTL support

Arabic (`ar`) uses a right-to-left layout. All other languages use left-to-right.

## How language is detected

TREK resolves the display language in this order:

1. **User preference** — the language saved to your account (set in Settings → Display).
2. **Browser language** — `navigator.languages` (and `navigator.language`) reported by your browser.
3. **Server default** — the `DEFAULT_LANGUAGE` environment variable set by the admin.
4. **Fallback** — English (`en`).

## Where the language picker appears

- **Login / Register page** — before you are signed in.
- **Settings → Display** — after you are signed in. See [Display-Settings](Display-Settings).
- **Public share pages** — trip share links.
- **Public journey pages** — public-facing journey views.

> **Admin:** The `DEFAULT_LANGUAGE` environment variable sets the fallback language shown on the login page and for unauthenticated users. See [Environment-Variables](Environment-Variables).

## See also

- [Display-Settings](Display-Settings)
- [Environment-Variables](Environment-Variables)
- [User-Settings](User-Settings)
