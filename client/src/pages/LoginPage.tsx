import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Input } from '../components/ui/input';
import { Eye, EyeOff, ArrowRight, Search, Send, Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSite } from '../contexts/SiteContext';
import { apiRequest } from '../lib/queryClient';
import { isTenantHost, isDevHost } from '../lib/host';

const INBOX_PREVIEW = [
  { name: 'Sara Khan', msg: 'AI replying…', time: 'now', initial: 'S', avatar: 'from-[#34d67e] to-[#1eb955]', channel: 'whatsapp', typing: true, unread: false, active: true },
  { name: 'James Lee', msg: 'Can I change my subscription plan?', time: '2m', initial: 'J', avatar: 'from-[#5aa0ff] to-[#0084ff]', channel: 'messenger', typing: false, unread: true, active: false },
  { name: 'Aisha Malik', msg: 'Loved the new update!', time: '5m', initial: 'A', avatar: 'from-[#f77737] to-[#e1306c]', channel: 'instagram', typing: false, unread: false, active: false },
  { name: 'Marco Diaz', msg: 'Thanks for the quick help!', time: '12m', initial: 'M', avatar: 'from-[#34d67e] to-[#1eb955]', channel: 'whatsapp', typing: false, unread: false, active: false },
];

const WhatsAppIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a12.062 12.062 0 005.71 1.447h.006c6.585 0 11.946-5.335 11.949-11.896 0-3.176-1.24-6.165-3.495-8.411" />
  </svg>
);

const MessengerIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z" />
  </svg>
);

const InstagramIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);

const CHANNEL_META: Record<string, { bg: string; icon: React.FC<{ className?: string }> }> = {
  whatsapp: { bg: 'bg-[#25d366]', icon: WhatsAppIcon },
  messenger: { bg: 'bg-[#0084ff]', icon: MessengerIcon },
  instagram: { bg: 'bg-[#e1306c]', icon: InstagramIcon },
};

const BotMark: React.FC<{ className?: string; fill?: string }> = ({ className, fill = '#25d366' }) => (
  <svg viewBox="0 0 40 52" className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M6 3 H34 A4 4 0 0 1 38 7 V17 A4 4 0 0 1 34 21 H6 A4 4 0 0 1 2 17 V7 A4 4 0 0 1 6 3 Z M11 12 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 Z M22.6 12 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 Z" fill={fill} />
    <rect x="4" y="25" width="32" height="5.5" rx="2" fill={fill} />
    <rect x="16.5" y="30" width="7" height="20" rx="2" fill={fill} />
  </svg>
);

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isOpening, setIsOpening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();
  const { siteData } = useSite();

  // Two-factor step. The password call returns a short-lived challenge token
  // instead of a session when 2FA applies; the real token only arrives after
  // POST /auth/2fa/challenge/verify succeeds.
  //   'verify' — the agent already enrolled, just needs the 6-digit code
  //   'setup'  — an admin turned on "Require 2FA"; enrol first, then verify
  const [tfaStage, setTfaStage] = useState<'verify' | 'setup' | null>(null);
  const [challengeToken, setChallengeToken] = useState('');
  const [tfaSetup, setTfaSetup] = useState<{ qr_data_uri: string; tfa_code: string } | null>(null);
  const [otp, setOtp] = useState('');

  // Login only makes sense on a tenant subdomain (an agency/workspace) — that's
  // how the backend resolves WHICH account to authenticate against. On the
  // central app host (app.agentawk.com) or the marketing apex there is no
  // tenant, so send the user to "find my account" to get their login links.
  // Dev hosts (localhost) stay open so local testing keeps working.
  useEffect(() => {
    if (!isTenantHost() && !isDevHost()) {
      navigate('/find-account');
    }
  }, [navigate]);

  // Landed here because the agent's login policy (allowed hours / IP) closed
  // mid-session and the API force-logged them out — show WHY. Read once, then
  // clear, so a later manual visit to /login isn't haunted by a stale notice.
  useEffect(() => {
    try {
      const reason = sessionStorage.getItem('login_blocked_reason');
      if (reason) {
        sessionStorage.removeItem('login_blocked_reason');
        setErrorMessage(reason);
      }
    } catch {
      /* storage disabled — the login form still works */
    }
  }, []);

  /**
   * Shared tail of a successful sign-in — reached either straight from the
   * password call or, when 2FA is on, only after the code verifies.
   */
  const finishLogin = (data: any) => {
    localStorage.setItem("auth_token", data.token);
    localStorage.setItem("user_info", JSON.stringify(data.user));

    setSuccessMessage(t('login_page.login_successful'));

    // Trigger the "curtain opening" animation: the two panels slide apart,
    // then we navigate once the animation has played.
    setIsOpening(true);

    setTimeout(() => {
      if (data.redirect_to) {
        navigate(data.redirect_to);
      } else if (data.user?.role === 'AGENCY' || data.user?.role === 'agency') {
        navigate('/org');
      } else {
        // Redirect workspace users to root for better layout stability
        navigate('/');
      }
    }, 550);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/auth/login', { email, password });

      const data = await response.json();

      // 2FA gate — no session token in this response, only a challenge token.
      if (data.requires_tfa) {
        setChallengeToken(data.challenge_token);
        setTfaStage(data.tfa_stage);
        setOtp('');
        if (data.tfa_stage === 'setup') {
          // Fetch the secret + QR to enrol with before asking for a code.
          const setupRes = await apiRequest('POST', '/auth/2fa/challenge/setup', {
            challenge_token: data.challenge_token,
          });
          setTfaSetup(await setupRes.json());
        }
        setIsLoading(false);
        return;
      }

      finishLogin(data);
    } catch (error: any) {
      console.error('Login error:', error);
      const msg = String(error?.message ?? '');
      const isInvalidCreds = msg.includes('401') || /invalid credentials/i.test(msg) || /unauthorized/i.test(msg);
      setErrorMessage(isInvalidCreds ? t('login_page.incorrect_password') : (msg || t('login_page.failed_to_connect')));
      setIsLoading(false);
    }
  };

  const handleTfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);
    try {
      const res = await apiRequest('POST', '/auth/2fa/challenge/verify', {
        challenge_token: challengeToken,
        otp,
      });
      finishLogin(await res.json());
    } catch (error: any) {
      const msg = String(error?.message ?? '');
      // The challenge token is only good for 10 minutes — once it lapses the
      // only way forward is to enter the password again.
      if (/expired/i.test(msg)) {
        setTfaStage(null);
        setChallengeToken('');
        setTfaSetup(null);
      }
      setErrorMessage(msg || t('login_page.failed_to_connect'));
      setOtp('');
      setIsLoading(false);
    }
  };

  const cancelTfa = () => {
    setTfaStage(null);
    setChallengeToken('');
    setTfaSetup(null);
    setOtp('');
    setErrorMessage('');
    setPassword('');
  };

  return (
    <div className="auth-page h-screen w-full overflow-hidden bg-white flex flex-col" style={{ fontFamily: "'Manrope', sans-serif" }}>
        {/* top nav */}
        <div className="flex items-center justify-between px-6 lg:px-10 py-5 border-b border-[#f0f2f5] shrink-0">
          <button type="button" onClick={() => navigate('/login')} className="flex items-center gap-2 cursor-default">
            <BotMark className="h-6 w-auto" />
            <span className="text-xl" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: '0.01em', color: '#0B1020' }}>
              agen<span className="text-[#25d366]">t</span><span className="text-[#25d366]">awk</span>
            </span>
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left Section — slides left like a curtain on successful login */}
          <div
            className={cn(
              "w-full lg:w-[600px] shrink-0 flex flex-col justify-center px-6 sm:px-10 lg:px-16 py-10 z-10 transition-transform duration-500 ease-in-out overflow-y-auto",
              isOpening && "-translate-x-full"
            )}
          >
            {tfaStage ? (
            /* ── Two-factor step ──────────────────────────────────────────
               Shown in place of the password form once the backend answers
               with a challenge token. The account is NOT signed in yet. */
            <div className="w-full max-w-md mx-auto">
              <div className="uppercase mb-2.5" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 12, letterSpacing: '0.2em', color: '#25d366' }}>
                {t('login_page.tfa.eyebrow')}
              </div>
              <h2 className="mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', color: '#0B1020', lineHeight: 1.15 }}>
                {tfaStage === 'setup' ? t('login_page.tfa.setup_headline') : t('login_page.tfa.verify_headline')}
              </h2>
              <p className="mb-7" style={{ fontSize: 15, lineHeight: 1.55, color: '#6b7482' }}>
                {tfaStage === 'setup' ? t('login_page.tfa.setup_sub') : t('login_page.tfa.verify_sub')}
              </p>

              {tfaStage === 'setup' && tfaSetup && (
                <div className="mb-7 rounded-xl border border-[#e2f0e8] bg-[#f4fbf7] p-4">
                  <div className="flex justify-center">
                    <img
                      src={tfaSetup.qr_data_uri}
                      alt={t('login_page.tfa.qr_alt')}
                      className="h-[180px] w-[180px] rounded-lg bg-white p-2"
                    />
                  </div>
                  <p className="mt-3 text-center" style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: '#6b7482' }}>
                    {t('login_page.tfa.manual_key')}
                  </p>
                  <p className="mt-1 text-center break-all" style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#0B1020', letterSpacing: '0.05em' }}>
                    {tfaSetup.tfa_code}
                  </p>
                </div>
              )}

              <form onSubmit={handleTfaSubmit} className="flex flex-col gap-6">
                <label className="block relative">
                  <span className="absolute -top-[9px] left-[11px] bg-white px-1.5 z-10" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 12, color: '#33475b', lineHeight: 1 }}>
                    <span style={{ color: '#f2545b' }}>* </span>{t('login_page.tfa.code_label')}
                  </span>
                  <Input
                    id="otp"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    required
                    placeholder="000000"
                    className="w-full h-[46px] rounded-[8px] border-[#D7D7D7] px-4 focus-visible:ring-0 text-center"
                    style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 20, letterSpacing: '0.4em', color: '#0B1020' }}
                  />
                  {errorMessage && (
                    <p className="mt-1.5 text-sm text-red-500">{errorMessage}</p>
                  )}
                  {successMessage && (
                    <p className="mt-1.5 text-sm text-[#1eb955]">{successMessage}</p>
                  )}
                </label>

                <button
                  type="submit"
                  disabled={isLoading || otp.length < 6}
                  className="w-full h-[52px] rounded-[11px] border-none flex items-center justify-center gap-2 text-white transition-colors disabled:opacity-70"
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: 16,
                    background: '#22B257',
                    boxShadow: '0 16px 34px -16px rgba(37,211,102,.7)',
                  }}
                >
                  {isLoading ? t('login_page.logging_in') : (
                    <>
                      {t('login_page.tfa.verify_button')} <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.6} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={cancelTfa}
                  className="text-center"
                  style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 13, color: '#6b7482' }}
                >
                  {t('login_page.tfa.back_to_login')}
                </button>
              </form>
            </div>
            ) : (
            <div className="w-full max-w-md mx-auto">
              <div className="uppercase mb-2.5" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 12, letterSpacing: '0.2em', color: '#25d366' }}>
                {t('login_page.welcome_back')}
              </div>
              <h2 className="mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', color: '#0B1020', lineHeight: 1.15 }}>
                {t('login_page.headline')}
              </h2>
              <p className="mb-8" style={{ fontSize: 15, lineHeight: 1.55, color: '#6b7482' }}>
                {t('login_page.subheadline')}
              </p>

              <form onSubmit={handleLogin} className="flex flex-col gap-8">
                <label className="block relative">
                  <span className="absolute -top-[9px] left-[11px] bg-white px-1.5 z-10" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 12, color: '#33475b', lineHeight: 1 }}>
                    <span style={{ color: '#f2545b' }}>* </span>{t('login_page.work_email')}
                  </span>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full h-[46px] rounded-[8px] border-[#D7D7D7] px-4 focus-visible:ring-0"
                    style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 500, fontSize: 15, color: '#0B1020' }}
                  />
                </label>

                <label className="block relative">
                  <span className="absolute -top-[9px] left-[11px] bg-white px-1.5 z-10" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 12, color: '#33475b', lineHeight: 1 }}>
                    <span style={{ color: '#f2545b' }}>* </span>{t('login_page.password')}
                  </span>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full h-[46px] rounded-[8px] border-[#D7D7D7] px-4 pr-10 focus-visible:ring-0"
                      style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 500, fontSize: 15, color: '#0B1020' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#9aa4b5] hover:text-[#25d366]"
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                  {errorMessage && (
                    <p className="mt-1.5 text-sm text-red-500">{errorMessage}</p>
                  )}
                  {successMessage && (
                    <p className="mt-1.5 text-sm text-[#1eb955]">{successMessage}</p>
                  )}
                </label>

                <div className="flex items-center justify-between -mt-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" className="w-[15px] h-[15px] rounded-[4px] border-[#cfd6e0] text-[#25d366] focus:ring-[#25d366]" />
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 500, fontSize: 13, color: '#6b7482' }}>{t('login_page.remember_me')}</span>
                  </label>
                  <a href="/forgot-password" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 13, color: '#1eb955' }}>
                    {t('login_page.forgot_password')}
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-[52px] rounded-[11px] border-none flex items-center justify-center gap-2 text-white transition-colors disabled:opacity-70"
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: 16,
                    background: '#22B257',
                    boxShadow: '0 16px 34px -16px rgba(37,211,102,.7)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1ea34e')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#22B257')}
                >
                  {isLoading ? t('login_page.logging_in') : (
                    <>
                      {t('login_page.log_in')} <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.6} />
                    </>
                  )}
                </button>
              </form>

              <p className="text-center mt-6" style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: '#6b7482' }}>
                {t('login_page.new_to_agentawk')}{' '}
                <button
                  type="button"
                  onClick={() => navigate('/signup')}
                  style={{ color: '#1eb955', fontWeight: 600 }}
                >
                  {t('login_page.create_account')}
                </button>
              </p>

              <div className="flex justify-center mt-7">
                <div
                  className="inline-flex items-center gap-2.5 rounded-xl px-4 py-2.5"
                  style={{ background: '#f4fbf7', border: '1px solid #e2f0e8' }}
                >
                  <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12, color: '#0084ff', letterSpacing: '-0.01em' }}>Meta</span>
                  <span className="w-px h-[13px]" style={{ background: '#cfe4d7' }} />
                  <span className="inline-flex items-center gap-1.5" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 11, color: '#0B1020' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#25d366" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    {t('login_page.verified_tech_partner')}
                  </span>
                </div>
              </div>
            </div>
            )}
          </div>

          {/* Right Section — slides right like a curtain on successful login */}
          <div
            className={cn(
              "hidden lg:block flex-1 relative overflow-hidden z-10 transition-transform duration-500 ease-in-out",
              isOpening && "translate-x-full"
            )}
            style={{ background: 'radial-gradient(110% 85% at 34% 32%, #eafaf0 0%, #f6fbf8 58%, #ffffff 100%)' }}
          >
            {/* decorative background shapes */}
            <div className="absolute rounded-full" style={{ left: '20%', top: 70, width: 260, height: 260, background: '#25d366', opacity: 0.1, animation: 'auth-pulse 6s ease-in-out infinite' }} />
            <div className="absolute rounded-full" style={{ right: 60, top: 130, width: 300, height: 300, background: '#25d366', opacity: 0.09, animation: 'auth-pulse 7s ease-in-out 1s infinite' }} />
            <div className="absolute rounded-full" style={{ right: 120, bottom: 30, width: 150, height: 150, border: '2px solid rgba(37,211,102,.20)', animation: 'auth-drift 6s ease-in-out infinite' }} />
            <div className="absolute rounded-full" style={{ left: 40, bottom: 24, width: 100, height: 100, border: '2px solid rgba(11,16,32,.06)' }} />
            <div className="absolute grid grid-cols-4 gap-3" style={{ right: 220, top: 46, opacity: 0.5 }}>
              {[0, 1, 1, 0, 1, 0, 1, 1].map((filled, i) => (
                <span key={i} className="w-[6px] h-[6px] rounded-full" style={{ background: filled ? '#25d366' : '#bfe8cf' }} />
              ))}
            </div>
            <div className="absolute rounded-full" style={{ left: 16, top: 90, width: 14, height: 14, background: '#25d366', opacity: 0.25, animation: 'auth-drift 5s ease-in-out .5s infinite' }} />
            <div className="absolute rounded" style={{ right: 30, bottom: 170, width: 10, height: 10, background: '#0084ff', opacity: 0.25, animation: 'auth-drift 4.5s ease-in-out infinite' }} />

            {/* floating channel bubbles */}
            <div className="absolute flex items-center gap-2 rounded-[14px] px-3.5 py-2.5 z-20" style={{ left: 170, top: 30, background: '#25d366', boxShadow: '0 14px 30px -12px rgba(37,211,102,.7)', animation: 'auth-popseq 9s ease-in-out 0s infinite' }}>
              <WhatsAppIcon className="w-4 h-4 text-white" />
              <span className="w-[26px] h-[5px] rounded-full bg-white/75" />
            </div>
            <div className="absolute flex items-center gap-2 rounded-[14px] px-3.5 py-2.5 z-20" style={{ left: 260, top: 16, background: '#0084ff', boxShadow: '0 14px 30px -12px rgba(0,132,255,.6)', animation: 'auth-popseq 9s ease-in-out 3s infinite' }}>
              <MessengerIcon className="w-4 h-4 text-white" />
              <span className="w-[26px] h-[5px] rounded-full bg-white/75" />
            </div>
            <div className="absolute flex items-center gap-2 rounded-[14px] px-3.5 py-2.5 z-20" style={{ left: 350, top: 32, background: '#e1306c', boxShadow: '0 14px 30px -12px rgba(225,48,108,.6)', animation: 'auth-popseq 9s ease-in-out 6s infinite' }}>
              <InstagramIcon className="w-4 h-4 text-white" />
              <span className="w-[26px] h-[5px] rounded-full bg-white/75" />
            </div>

            {/* depth stack */}
            <div className="absolute rounded-2xl bg-white" style={{ left: 114, top: 78, width: 460, height: 330, opacity: 0.35, boxShadow: '0 20px 44px -28px rgba(11,16,32,.4)' }} />
            <div className="absolute rounded-2xl bg-white" style={{ left: 102, top: 86, width: 470, height: 335, opacity: 0.6, boxShadow: '0 24px 50px -28px rgba(11,16,32,.45)' }} />

            {/* browser mockup */}
            <div
              className="absolute rounded-2xl overflow-hidden bg-white"
              style={{ left: 90, top: 96, width: 480, boxShadow: '0 34px 70px -30px rgba(11,16,32,.55)', animation: 'auth-drift 6s ease-in-out infinite' }}
            >
              <div className="flex items-center gap-1.5 px-4 py-2.5" style={{ background: '#eef1f5', borderBottom: '1px solid #e4e8ee' }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f57' }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#febc2e' }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#28c840' }} />
                <span className="ml-3 flex-1 max-w-[220px] h-6 rounded-md bg-white flex items-center gap-1.5 px-3" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 10, color: '#8b93a4' }}>
                  <Lock className="w-[11px] h-[11px] text-[#25d366]" />
                  app.agentawk.com/inbox
                </span>
              </div>
              <div className="flex" style={{ height: 300 }}>
                {/* sidebar */}
                <div className="shrink-0 flex flex-col p-3" style={{ width: 132, background: '#0B1020' }}>
                  <div className="flex items-center gap-1.5 pb-3">
                    <BotMark className="h-4 w-auto" />
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12, color: '#fff' }}>
                      agen<span className="text-[#25d366]">t</span><span className="text-[#25d366]">awk</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: '#25d366' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#05130b" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
                      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                    </svg>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 11, color: '#05130b' }}>Inbox</span>
                  </div>
                  <div className="pt-3.5 pb-1.5 px-1" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 9, letterSpacing: '.12em', color: '#5b6478' }}>
                    CHANNELS
                  </div>
                  {[
                    { label: 'WhatsApp', channel: 'whatsapp', count: 2 },
                    { label: 'Messenger', channel: 'messenger', count: 1 },
                    { label: 'Instagram', channel: 'instagram', count: 1 },
                  ].map((c) => {
                    const meta = CHANNEL_META[c.channel];
                    const Icon = meta.icon;
                    return (
                      <div key={c.channel} className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
                        <span className={cn("w-[18px] h-[18px] rounded-[5px] flex items-center justify-center shrink-0", meta.bg)}>
                          <Icon className="w-[10px] h-[10px] text-white" />
                        </span>
                        <span className="flex-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 11, color: '#cfd6e2' }}>{c.label}</span>
                        <span className="min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center" style={{ background: '#25d366', color: '#05130b', fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 9 }}>{c.count}</span>
                      </div>
                    );
                  })}
                  <div className="flex-1" />
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white">
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 9, color: '#0084ff' }}>Meta</span>
                    <span className="w-px h-3" style={{ background: '#e2e6ec' }} />
                    <span className="inline-flex items-center gap-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 9, color: '#0B1020' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#25d366" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      Partner
                    </span>
                  </div>
                </div>

                {/* inbox preview */}
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="flex items-center gap-2.5 px-3.5 py-3" style={{ borderBottom: '1px solid #eef0f4' }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, color: '#0B1020' }}>Inbox</span>
                    <span className="flex-1 h-6 rounded-full flex items-center gap-1.5 px-3" style={{ background: '#f2f5f8' }}>
                      <Search className="w-3 h-3 text-[#9aa4b5]" />
                      <span className="w-16 h-1 rounded" style={{ background: '#dbe1e8' }} />
                    </span>
                    <span className="px-2 py-0.5 rounded-full" style={{ background: '#25d366', fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 9, color: '#05130b' }}>1 new</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {INBOX_PREVIEW.map((c) => {
                      const meta = CHANNEL_META[c.channel];
                      const Icon = meta.icon;
                      return (
                        <div
                          key={c.name}
                          className={cn("flex items-center gap-2.5 px-3.5 py-2.5", c.active && "border-l-[3px]")}
                          style={c.active ? { background: '#f4fbf7', borderLeftColor: '#25d366' } : undefined}
                        >
                          <span className="relative shrink-0">
                            <span className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white bg-gradient-to-br", c.avatar)} style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13 }}>
                              {c.initial}
                            </span>
                            <span className={cn("absolute -right-0.5 -bottom-0.5 w-[15px] h-[15px] rounded-full flex items-center justify-center border-2 border-white", meta.bg)}>
                              <Icon className="w-[7px] h-[7px] text-white" />
                            </span>
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center">
                              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 12, color: '#0B1020' }}>{c.name}</span>
                              <span className="ml-auto" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 500, fontSize: 10, color: '#9aa4b5' }}>{c.time}</span>
                            </div>
                            {c.typing ? (
                              <div className="flex items-center gap-1 mt-0.5">
                                <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 10, color: '#25d366' }}>AI replying</span>
                                <span className="inline-flex gap-0.5">
                                  <span className="w-1 h-1 rounded-full bg-[#25d366]" style={{ animation: 'auth-drift 1s ease-in-out infinite' }} />
                                  <span className="w-1 h-1 rounded-full bg-[#25d366]" style={{ animation: 'auth-drift 1s ease-in-out .2s infinite' }} />
                                  <span className="w-1 h-1 rounded-full bg-[#25d366]" style={{ animation: 'auth-drift 1s ease-in-out .4s infinite' }} />
                                </span>
                              </div>
                            ) : (
                              <div className="truncate mt-0.5" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: c.unread ? 600 : 500, fontSize: 11, color: c.unread ? '#0B1020' : '#6b7482' }}>
                                {c.msg}
                              </div>
                            )}
                          </div>
                          {c.unread && <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: '#25d366' }} />}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5" style={{ borderTop: '1px solid #eef0f4', background: '#fbfcfd' }}>
                    <span className="flex-1 h-7 rounded-full flex items-center px-3" style={{ background: '#f2f5f8' }}>
                      <span className="w-24 h-1 rounded" style={{ background: '#dbe1e8' }} />
                    </span>
                    <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: '#25d366' }}>
                      <Send className="w-3.5 h-3.5 text-white" strokeWidth={2.4} />
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* dashed connector */}
            <svg className="absolute pointer-events-none" style={{ inset: 0, width: '100%', height: '100%' }} fill="none">
              <path d="M470 250 C 500 280, 520 320, 540 360" stroke="#25d366" strokeWidth={2.5} strokeLinecap="round" strokeDasharray="1 9" style={{ animation: 'auth-dash 1s linear infinite' }} opacity={0.55} />
            </svg>

            {/* robot mascot */}
            <svg viewBox="0 0 300 420" className="absolute" style={{ right: 40, bottom: 20, width: 160, height: 224, overflow: 'visible' }}>
              <ellipse cx="168" cy="404" rx="78" ry="12" fill="#0B1020" opacity="0.08" />
              <g style={{ animation: 'auth-flt 4.4s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }}>
                <line x1="172" y1="44" x2="172" y2="66" stroke="#25d366" strokeWidth={7} strokeLinecap="round" />
                <circle cx="172" cy="36" r="8" fill="#25d366" />
                <rect x="108" y="66" width="128" height="90" rx="28" fill="#25d366" />
                <rect x="122" y="82" width="100" height="58" rx="20" fill="#0B1020" />
                <g style={{ animation: 'auth-blink 4.8s infinite', transformBox: 'fill-box', transformOrigin: 'center' }}>
                  <circle cx="150" cy="111" r="10" fill="#fff" />
                  <circle cx="194" cy="111" r="10" fill="#fff" />
                </g>
                <rect x="120" y="164" width="104" height="94" rx="26" fill="#25d366" />
                <rect x="139" y="184" width="66" height="42" rx="12" fill="#eafaf0" />
                <rect x="132" y="258" width="30" height="26" rx="10" fill="#1eb955" />
                <rect x="182" y="258" width="30" height="26" rx="10" fill="#1eb955" />
                <rect x="224" y="176" width="24" height="64" rx="12" fill="#1eb955" />
                <rect x="86" y="176" width="24" height="46" rx="12" fill="#1eb955" />
                <g style={{ animation: 'auth-drift 3.4s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: '98px 210px' }}>
                  <rect x="60" y="204" width="50" height="23" rx="11.5" fill="#1eb955" />
                  <circle cx="62" cy="215" r="14" fill="#25d366" />
                  <rect x="42" y="208" width="24" height="15" rx="7.5" fill="#25d366" />
                </g>
              </g>
            </svg>
          </div>
        </div>
    </div>
  );
};

export default LoginPage;
