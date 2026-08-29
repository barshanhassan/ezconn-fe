import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, ArrowRight, UserPlus, KeyRound, LogIn, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { apiRequest } from '../lib/queryClient';
import { toast } from '../hooks/use-toast';

const WhatsAppIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a12.062 12.062 0 005.71 1.447h.006c6.585 0 11.946-5.335 11.949-11.896 0-3.176-1.24-6.165-3.495-8.411" />
  </svg>
);

const InstagramIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <defs>
      <radialGradient id="ai-ig-grad" cx="0.3" cy="1" r="1.1">
        <stop offset="0" stopColor="#FDD870" />
        <stop offset=".25" stopColor="#F9A83B" />
        <stop offset=".5" stopColor="#E1306C" />
        <stop offset=".75" stopColor="#C13584" />
        <stop offset="1" stopColor="#833AB4" />
      </radialGradient>
    </defs>
    <path fill="url(#ai-ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);

const MessengerIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <defs>
      <linearGradient id="ai-msg-grad" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#0099FF" />
        <stop offset=".6" stopColor="#A033FF" />
        <stop offset="1" stopColor="#FF5280" />
      </linearGradient>
    </defs>
    <path fill="url(#ai-msg-grad)" d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z" />
  </svg>
);

const FLOATING_ICONS = [
  { Icon: WhatsAppIcon, left: 453, top: 72, delay: '0s', dur: '4.2s' },
  { Icon: InstagramIcon, left: 378, top: 23, delay: '.9s', dur: '4.6s' },
  { Icon: MessengerIcon, left: 469, top: 165, delay: '.5s', dur: '5.1s' },
];

const useOnboardSteps = (t: (key: string) => string) => [
  { label: t('accept_invitation_page.step1_label'), icon: UserPlus, title: t('accept_invitation_page.step1_title'), subtitle: t('accept_invitation_page.step1_subtitle'), dark: false },
  { label: t('accept_invitation_page.step2_label'), icon: KeyRound, title: t('accept_invitation_page.step2_title'), subtitle: t('accept_invitation_page.step2_subtitle'), dark: false },
  { label: t('accept_invitation_page.step3_label'), icon: LogIn, title: t('accept_invitation_page.step3_title'), subtitle: t('accept_invitation_page.step3_subtitle'), dark: true },
];

const BotMark: React.FC<{ className?: string; fill?: string }> = ({ className, fill = '#25d366' }) => (
  <svg viewBox="0 0 40 52" className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M6 3 H34 A4 4 0 0 1 38 7 V17 A4 4 0 0 1 34 21 H6 A4 4 0 0 1 2 17 V7 A4 4 0 0 1 6 3 Z M11 12 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 Z M22.6 12 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 Z" fill={fill} />
    <rect x="4" y="25" width="32" height="5.5" rx="2" fill={fill} />
    <rect x="16.5" y="30" width="7" height="20" rx="2" fill={fill} />
  </svg>
);

const AcceptInvitationPage: React.FC = () => {
  const { t } = useTranslation();
  const ONBOARD_STEPS = useOnboardSteps(t);
  const [invitationId, setInvitationId] = useState('');
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [rePassword, setRePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('invitation_id') || '';
    setInvitationId(id);
    if (!id) {
      setStatus('invalid');
      return;
    }
    apiRequest('POST', '/auth/validate-invitation', { invitation_id: id })
      .then((res) => res.json())
      .then((data: any) => {
        setEmail(data?.member?.email || '');
        setFirstName(data?.member?.first_name || '');
        setLastName(data?.member?.last_name || '');
        setStatus('valid');
      })
      .catch(() => setStatus('invalid'));
  }, []);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (password !== rePassword) {
      setErrorMessage(t('accept_invitation_page.passwords_no_match'));
      return;
    }
    if (password.length < 8) {
      setErrorMessage(t('accept_invitation_page.password_min_length'));
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest('POST', '/auth/accept-invitation', {
        invitation_id: invitationId,
        first_name: firstName,
        last_name: lastName,
        password,
        re_password: rePassword,
      });
      toast({
        title: t('accept_invitation_page.toast_password_set_title'),
        description: t('accept_invitation_page.toast_password_set_desc'),
      });
      navigate('/login');
    } catch (error: any) {
      setErrorMessage(error?.message || t('accept_invitation_page.accept_invitation_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputLabelCls = "absolute -top-[9px] left-[11px] bg-white px-1.5 z-10";
  const inputLabelStyle: React.CSSProperties = { fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 12, color: '#33475b', lineHeight: 1 };
  const inputCls = "w-full h-[46px] rounded-[8px] border border-[#D7D7D7] px-4 focus:outline-none focus:ring-0";
  const inputStyle: React.CSSProperties = { fontFamily: "'Manrope', sans-serif", fontWeight: 500, fontSize: 15, color: '#0B1020' };

  return (
    <div className="auth-page h-screen w-full overflow-hidden bg-white flex flex-col" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* top nav */}
      <div className="flex items-center px-6 lg:px-10 py-5 border-b border-[#f0f2f5] shrink-0">
        <button type="button" onClick={() => navigate('/login')} className="flex items-center gap-2 cursor-default">
          <BotMark className="h-6 w-auto" />
          <span className="text-xl" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: '0.01em', color: '#0B1020' }}>
            agen<span className="text-[#25d366]">t</span><span className="text-[#25d366]">awk</span>
          </span>
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left Section — form */}
        <div className="w-full lg:w-[600px] shrink-0 flex flex-col justify-center px-6 sm:px-10 lg:px-16 py-10 z-10 overflow-y-auto">
          <div className="w-full max-w-md mx-auto">
            {status === 'loading' && (
              <div className="text-center py-16" style={{ color: '#6b7482' }}>{t('accept_invitation_page.checking_invitation')}</div>
            )}

            {status === 'invalid' && (
              <div className="text-center py-10 space-y-4">
                <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#fef2f2' }}>
                  <AlertCircle className="w-7 h-7" style={{ color: '#f2545b' }} />
                </div>
                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 26, color: '#0B1020' }}>
                  {t('accept_invitation_page.invalid_title')}
                </h2>
                <p style={{ fontSize: 14, color: '#6b7482' }}>
                  {t('accept_invitation_page.invalid_desc')}
                </p>
                <button type="button" onClick={() => navigate('/login')} style={{ color: '#1eb955', fontWeight: 600, fontSize: 14 }}>
                  &lt; {t('accept_invitation_page.back_to_login')}
                </button>
              </div>
            )}

            {status === 'valid' && (
              <>
                <div className="uppercase mb-2.5" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 12, letterSpacing: '0.2em', color: '#25d366' }}>
                  {t('accept_invitation_page.account_activation')}
                </div>
                <h2 className="mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', color: '#0B1020', lineHeight: 1.15 }}>
                  {t('accept_invitation_page.set_password_title')}
                </h2>
                <p className="mb-8" style={{ fontSize: 15, lineHeight: 1.55, color: '#6b7482' }}>
                  {t('accept_invitation_page.for_email_prefix')} <span style={{ fontWeight: 700, color: '#0B1020' }}>{email}</span> {t('accept_invitation_page.for_email_suffix')}
                </p>

                <form onSubmit={handleAccept} className="flex flex-col gap-8">
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block relative">
                      <span className={inputLabelCls} style={inputLabelStyle}>{t('accept_invitation_page.first_name')}</span>
                      <input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        maxLength={100}
                        className={inputCls}
                        style={inputStyle}
                      />
                    </label>
                    <label className="block relative">
                      <span className={inputLabelCls} style={inputLabelStyle}>{t('accept_invitation_page.last_name')}</span>
                      <input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        maxLength={100}
                        className={inputCls}
                        style={inputStyle}
                      />
                    </label>
                  </div>

                  <label className="block relative">
                    <span className={inputLabelCls} style={inputLabelStyle}>{t('accept_invitation_page.password')}</span>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder={t('accept_invitation_page.password_placeholder')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        className={cn(inputCls, "pr-10")}
                        style={inputStyle}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#9aa4b5] hover:text-[#25d366]"
                      >
                        {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                      </button>
                    </div>
                  </label>

                  <label className="block relative">
                    <span className={inputLabelCls} style={inputLabelStyle}>{t('accept_invitation_page.confirm_password')}</span>
                    <input
                      id="rePassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('accept_invitation_page.confirm_password_placeholder')}
                      value={rePassword}
                      onChange={(e) => setRePassword(e.target.value)}
                      required
                      minLength={8}
                      className={inputCls}
                      style={inputStyle}
                    />
                    {errorMessage && <p className="mt-1.5 text-sm text-red-500">{errorMessage}</p>}
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-[52px] rounded-[11px] border-none flex items-center justify-center gap-2 text-white transition-colors disabled:opacity-70"
                    style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, background: '#22B257', boxShadow: '0 16px 34px -16px rgba(37,211,102,.7)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#1ea34e')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#22B257')}
                  >
                    {isSubmitting ? t('accept_invitation_page.activating') : (<>{t('accept_invitation_page.submit_button')} <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.6} /></>)}
                  </button>
                </form>

                <p className="text-center mt-6" style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: '#6b7482' }}>
                  <button type="button" onClick={() => navigate('/login')} style={{ color: '#1eb955', fontWeight: 600 }}>
                    &lt; {t('accept_invitation_page.back_to_login')}
                  </button>
                </p>
              </>
            )}

            <div className="flex justify-center mt-12">
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
                  {t('accept_invitation_page.verified_tech_partner')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section — decorative */}
        <div
          className="hidden lg:block flex-1 relative overflow-hidden z-10"
          style={{ background: 'linear-gradient(135deg, #eafaf0 0%, #f2fbf6 45%, #ffffff 100%)' }}
        >
          {/* decor */}
          <div className="absolute rounded-full" style={{ right: 77, top: 60, width: 238, height: 238, background: '#25d366', opacity: 0.1, animation: 'auth-pulse 6s ease-in-out infinite' }} />
          <div className="absolute rounded-full" style={{ right: 43, bottom: 51, width: 119, height: 119, border: '2px solid rgba(37,211,102,.18)', animation: 'auth-drift 6s ease-in-out infinite' }} />
          <div className="absolute grid grid-cols-4 gap-2.5" style={{ left: 41, top: 31, opacity: 0.5 }}>
            {[1, 0.3, 0.3, 1, 0.3, 1, 0.3, 0.3].map((o, i) => (
              <span key={i} className="w-[6px] h-[6px] rounded-full" style={{ background: o === 1 ? '#25d366' : '#bfe8cf' }} />
            ))}
          </div>

          {/* headline */}
          <div className="absolute" style={{ left: 41, top: 63, width: 340 }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24, letterSpacing: '-0.02em', color: '#0B1020', lineHeight: 1.15 }}>
              {t('accept_invitation_page.join_team_headline')}
            </div>
          </div>

          {/* floating channel chips */}
          {FLOATING_ICONS.map(({ Icon, left, top, delay, dur }, i) => (
            <div
              key={i}
              className="absolute z-10 rounded-2xl bg-white flex items-center justify-center"
              style={{ left, top, width: 44, height: 44, boxShadow: '0 12px 26px -8px rgba(11,16,32,.18)', animation: `auth-drift ${dur} ease-in-out ${delay} infinite` }}
            >
              <Icon className="w-6 h-6" />
            </div>
          ))}

          {/* onboarding step rail */}
          <div className="absolute" style={{ left: 41, top: 128, width: 340 }}>
            <div className="absolute rounded-full" style={{ left: 20, top: 20, bottom: 20, width: 3, background: '#e4ece7' }} />
            <div className="relative flex flex-col" style={{ gap: 15 }}>
              {ONBOARD_STEPS.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="flex items-center" style={{ gap: 13 }}>
                    <span
                      className="rounded-full flex items-center justify-center shrink-0 relative z-10"
                      style={{ width: 41, height: 41, background: '#22B257' }}
                    >
                      <Icon className="w-[18px] h-[18px] text-white" strokeWidth={2.2} />
                    </span>
                    <div
                      className="flex-1 rounded-2xl"
                      style={s.dark
                        ? { background: '#0B1020', padding: '12px 15px', boxShadow: '0 18px 38px -22px rgba(11,16,32,.5)' }
                        : { background: '#fff', border: '1px solid #eef0f4', padding: '12px 15px', boxShadow: '0 15px 34px -24px rgba(11,16,32,.4)' }}
                    >
                      <div className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 9, letterSpacing: '.08em', color: '#25d366' }}>
                        {s.label}
                      </div>
                      <div className="mt-0.5" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: s.dark ? '#fff' : '#0B1020' }}>
                        {s.title}
                      </div>
                      <div className="mt-0.5" style={{ fontSize: 11, color: s.dark ? '#9aa4b5' : '#6b7482' }}>
                        {s.subtitle}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* mascot */}
          <svg viewBox="0 0 220 360" style={{ position: 'absolute', left: 380, top: 296, width: 213, height: 376, overflow: 'visible' }}>
            <ellipse cx="120" cy="348" rx="82" ry="12" fill="#0B1020" opacity="0.08" />
            <g style={{ animation: 'auth-flt 4.4s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }}>
              <line x1="108" y1="52" x2="108" y2="74" stroke="#25d366" strokeWidth={7} strokeLinecap="round" />
              <circle cx="108" cy="44" r="8" fill="#25d366" />
              <rect x="44" y="74" width="128" height="90" rx="28" fill="#25d366" />
              <rect x="58" y="90" width="100" height="58" rx="20" fill="#0B1020" />
              <g style={{ animation: 'auth-blink 4.8s infinite', transformBox: 'fill-box', transformOrigin: 'center' }}>
                <circle cx="86" cy="119" r="10" fill="#fff" />
                <circle cx="130" cy="119" r="10" fill="#fff" />
              </g>
              <rect x="56" y="172" width="104" height="94" rx="26" fill="#25d366" />
              <rect x="75" y="192" width="66" height="42" rx="12" fill="#eafaf0" />
              <rect x="68" y="266" width="30" height="26" rx="10" fill="#1eb955" />
              <rect x="118" y="266" width="30" height="26" rx="10" fill="#1eb955" />
              <rect x="160" y="184" width="24" height="72" rx="12" fill="#1eb955" />
              <rect x="32" y="184" width="24" height="72" rx="12" fill="#1eb955" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default AcceptInvitationPage;
