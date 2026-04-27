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
  verifyIdToken,
  findOrCreateUser,
  touchLastLogin,
  generateToken,
  frontendUrl,
  getAppUrl,
} from '../services/oidcService';
import { resolveAuthToggles } from '../services/authService';

const router = express.Router();

// ---- GET /login ----------------------------------------------------------

router.get('/login', async (req: Request, res: Response) => {
  if (!resolveAuthToggles().oidc_login) {
    return res.status(403).json({ error: 'SSO login is disabled.' });
  }

  const config = getOidcConfig();
  if (!config) return res.status(400).json({ error: 'OIDC not configured' });

  if (config.issuer && !config.issuer.startsWith('https://') && process.env.NODE_ENV?.toLowerCase() === 'production') {
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
      scope: process.env.OIDC_SCOPE || 'openid email profile',
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
  if (!resolveAuthToggles().oidc_login) {
    return res.redirect(frontendUrl('/login?oidc_error=sso_disabled'));
  }

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

  if (config.issuer && !config.issuer.startsWith('https://') && process.env.NODE_ENV?.toLowerCase() === 'production') {
    return res.redirect(frontendUrl('/login?oidc_error=issuer_not_https'));
  }

  try {
    const doc = await discover(config.issuer, config.discoveryUrl);

    const tokenData = await exchangeCodeForToken(doc, code, pending.redirectUri, config.clientId, config.clientSecret);
    if (!tokenData._ok || !tokenData.access_token) {
      console.error('[OIDC] Token exchange failed: status', tokenData._status);
      return res.redirect(frontendUrl('/login?oidc_error=token_failed'));
    }

    // Strict id_token verification: signature via JWKS + iss + aud.
    // Previously only the access_token was used to hit userinfo, so a
    // compromised provider or MITM could supply a crafted userinfo
    // response the server would blindly trust. When the id_token is
    // missing from the token response (non-compliant provider) we still
    // reject — an Authorization Code flow MUST return one per OIDC Core.
    if (!tokenData.id_token) {
      console.error('[OIDC] Token response missing id_token — refusing login');
      return res.redirect(frontendUrl('/login?oidc_error=no_id_token'));
    }
    const idVerify = await verifyIdToken(
      tokenData.id_token,
      doc,
      config.clientId,
      (doc.issuer ?? '').replace(/\/+$/, '') || config.issuer,
    );
    if (idVerify.ok !== true) {
      const reason = 'error' in idVerify ? idVerify.error : 'unknown';
      console.error('[OIDC] id_token verification failed:', reason);
      return res.redirect(frontendUrl('/login?oidc_error=id_token_invalid'));
    }

    const userInfo = await getUserInfo(doc.userinfo_endpoint, tokenData.access_token);
    if (!userInfo.email) {
      return res.redirect(frontendUrl('/login?oidc_error=no_email'));
    }
    // Cross-check: the userinfo response must be for the same subject
    // the id_token signed. Catches a compromised userinfo endpoint that
    // speaks for a different principal than the id_token's claim.
    const tokenSub = idVerify.claims.sub;
    if (typeof tokenSub === 'string' && userInfo.sub && userInfo.sub !== tokenSub) {
      console.error('[OIDC] userinfo.sub does not match id_token.sub — refusing login');
      return res.redirect(frontendUrl('/login?oidc_error=subject_mismatch'));
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

  setAuthCookie(res, result.token, req);
  res.json({ token: result.token });
});

export default router;
