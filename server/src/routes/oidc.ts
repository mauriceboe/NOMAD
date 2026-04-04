import express, { Request, Response } from 'express';
import { setAuthCookie } from '../services/cookie';
import {
  getOidcConfig,
  discover,
  createState,
  consumeState,
  createAuthCode,
  consumeAuthCode,
  exchangeCodeForToken,
  getUserInfo,
  findOrCreateUser,
  touchLastLogin,
  generateToken,
  frontendUrl,
  getAppUrl,
} from '../services/oidcService';

const router = express.Router();

// ---- GET /login ----------------------------------------------------------

router.get('/login', async (req: Request, res: Response) => {
  const config = getOidcConfig();
  if (!config) return res.status(400).json({ error: 'OIDC not configured' });

  if (config.issuer && !config.issuer.startsWith('https://') && process.env.NODE_ENV === 'production') {
    return res.status(400).json({ error: 'OIDC issuer must use HTTPS in production' });
  }

  try {
    const doc = await discover(config.issuer, config.discoveryUrl);
    const appUrl = getAppUrl();
    if (!appUrl) {
      return res.status(500).json({ error: 'APP_URL is not configured. OIDC cannot be used.' });
    }

    const redirectUri = `${appUrl.replace(/\/+$/, '')}/api/auth/oidc/callback`;
    const inviteToken = req.query.invite as string | undefined;
    const state = createState(redirectUri, inviteToken);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: process.env.OIDC_SCOPE || 'openid email profile groups',
      state,
    });

    res.redirect(`${doc.authorization_endpoint}?${params}`);
  } catch (err: unknown) {
    console.error('[OIDC] Login error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'OIDC login failed' });
  }
});

// ---- GET /callback -------------------------------------------------------

router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error: oidcError } = req.query as { code?: string; state?: string; error?: string };

  if (oidcError) {
    console.error('[OIDC] Provider error:', oidcError);
    return res.redirect(frontendUrl('/login?oidc_error=' + encodeURIComponent(oidcError)));
  }
  if (!code || !state) {
    return res.redirect(frontendUrl('/login?oidc_error=missing_params'));
  }

  const pending = consumeState(state);
  if (!pending) {
    return res.redirect(frontendUrl('/login?oidc_error=invalid_state'));
  }

  const config = getOidcConfig();
  if (!config) return res.redirect(frontendUrl('/login?oidc_error=not_configured'));

  if (config.issuer && !config.issuer.startsWith('https://') && process.env.NODE_ENV === 'production') {
    return res.redirect(frontendUrl('/login?oidc_error=issuer_not_https'));
  }

  try {
    const doc = await discover(config.issuer, config.discoveryUrl);

    const tokenData = await exchangeCodeForToken(doc, code, pending.redirectUri, config.clientId, config.clientSecret);
    if (!tokenData._ok || !tokenData.access_token) {
      console.error('[OIDC] Token exchange failed: status', tokenData._status);
      return res.redirect(frontendUrl('/login?oidc_error=token_failed'));
    }

    const userInfo = await getUserInfo(doc.userinfo_endpoint, tokenData.access_token);
    if (!userInfo.email) {
      return res.redirect(frontendUrl('/login?oidc_error=no_email'));
    }

    const result = findOrCreateUser(userInfo, config, pending.inviteToken);
    if ('error' in result) {
      return res.redirect(frontendUrl('/login?oidc_error=' + result.error));
    }

    touchLastLogin(result.user.id);
    const jwtToken = generateToken(result.user);
    const authCode = createAuthCode(jwtToken);
    res.redirect(frontendUrl('/login?oidc_code=' + authCode));
  } catch (err: unknown) {
    console.error('[OIDC] Callback error:', err);
    res.redirect(frontendUrl('/login?oidc_error=server_error'));
  }
});

// ---- GET /exchange -------------------------------------------------------

router.get('/exchange', (req: Request, res: Response) => {
  const { code } = req.query as { code?: string };
  if (!code) return res.status(400).json({ error: 'Code required' });

  const result = consumeAuthCode(code);
  if ('error' in result) return res.status(400).json({ error: result.error });

  setAuthCookie(res, result.token);
  res.json({ token: result.token });
});

export default router;
