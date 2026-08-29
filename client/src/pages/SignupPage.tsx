import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Input } from '../components/ui/input';
import { ArrowLeft, ArrowRight, User, Link2, MailCheck, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { apiRequest } from '../lib/queryClient';
import { isAppHost, isDevHost, appHostUrl } from '../lib/host';

const OTP_LENGTH = 4;
const RESEND_COOLDOWN_SECONDS = 60;

const WhatsAppIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a12.062 12.062 0 005.71 1.447h.006c6.585 0 11.946-5.335 11.949-11.896 0-3.176-1.24-6.165-3.495-8.411" />
  </svg>
);

const InstagramIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <defs>
      <radialGradient id="sg-ig-grad" cx="0.3" cy="1" r="1.1">
        <stop offset="0" stopColor="#FDD870" />
        <stop offset=".25" stopColor="#F9A83B" />
        <stop offset=".5" stopColor="#E1306C" />
        <stop offset=".75" stopColor="#C13584" />
        <stop offset="1" stopColor="#833AB4" />
      </radialGradient>
    </defs>
    <path fill="url(#sg-ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);

const MessengerIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <defs>
      <linearGradient id="sg-msg-grad" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#0099FF" />
        <stop offset=".6" stopColor="#A033FF" />
        <stop offset="1" stopColor="#FF5280" />
      </linearGradient>
    </defs>
    <path fill="url(#sg-msg-grad)" d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z" />
  </svg>
);

const TelegramIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <circle cx="12" cy="12" r="12" fill="#26A5E4" />
    <path fill="#fff" d="M5.5 11.7 16.2 7.4c.5-.18.94.12.78.88l-1.82 8.6c-.13.6-.5.75-1 .47l-2.77-2.04-1.34 1.29c-.15.15-.27.27-.55.27l.2-2.83 5.15-4.65c.22-.2-.05-.31-.35-.11l-6.36 4-2.74-.86c-.6-.19-.61-.6.13-.9z" />
  </svg>
);

const ShopifyIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <path fill="#95BF47" d="M6 8V6.2A4.2 4.2 0 0 1 10.2 2c1.9 0 3.5 1.3 4 3.1l1.7.5a.7.7 0 0 1 .5.5l1.9 12.7a1 1 0 0 1-.8 1.1L8 21.9a1 1 0 0 1-1.2-.8L4.2 8.8A.7.7 0 0 1 4.8 8H6zm1.8-.4 4.6-1.3A2.5 2.5 0 0 0 10.2 4 2.4 2.4 0 0 0 7.8 6.4v1.2z" />
    <path fill="#fff" d="M12.6 10.5c-1.1 0-1.9.7-1.9 1.7 0 1.4 2.1 1.4 2.1 2.4 0 .3-.2.5-.6.6-.6.1-1.3-.3-1.3-.3l-.2 1.5s.6.4 1.6.2c1.2-.2 1.9-1 1.8-2.1-.1-1.5-2.2-1.4-2.2-2.3 0-.3.2-.5.6-.6.5-.1 1 .2 1 .2l.4-1.4s-.5-.2-1.3-.1z" />
  </svg>
);

const BurstSparkleIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className}>
    <g fill="#D97757">
      {[0, 33, 65, 98, 131, 163, 196, 229, 262, 294, 327].map((deg) => (
        <rect key={deg} x="18.6" y="5" width="2.8" height="14" rx="1.4" transform={`rotate(${deg} 20 20)`} />
      ))}
    </g>
  </svg>
);

const DiamondSparkleIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <defs>
      <radialGradient id="sg-gem-grad" cx="0.15" cy="0.9" r="1.2">
        <stop offset="0" stopColor="#1C7DFF" />
        <stop offset=".52" stopColor="#4C8DF6" />
        <stop offset="1" stopColor="#B96BF3" />
      </radialGradient>
    </defs>
    <path fill="url(#sg-gem-grad)" d="M12 0c0 6.627 5.373 12 12 12-6.627 0-12 5.373-12 12 0-6.627-5.373-12-12-12C6.627 12 12 6.627 12 0z" />
  </svg>
);

const WandIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8a2 2 0 0 0-3 0z" />
    <path d="M12 15 9 12a11 11 0 0 1 5-8c2.5-1.8 5-2 6.5-2 .1 1.5-.2 4-2 6.5a11 11 0 0 1-8 5z" />
    <path d="M15 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
  </svg>
);

const BotMark: React.FC<{ className?: string; fill?: string }> = ({ className, fill = '#25d366' }) => (
  <svg viewBox="0 0 40 52" className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M6 3 H34 A4 4 0 0 1 38 7 V17 A4 4 0 0 1 34 21 H6 A4 4 0 0 1 2 17 V7 A4 4 0 0 1 6 3 Z M11 12 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 Z M22.6 12 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 Z" fill={fill} />
    <rect x="4" y="25" width="32" height="5.5" rx="2" fill={fill} />
    <rect x="16.5" y="30" width="7" height="20" rx="2" fill={fill} />
  </svg>
);

const FLOATING_ICONS = [
  { Icon: WhatsAppIcon, left: 453, top: 72, delay: '0s', dur: '4.2s' },
  { Icon: InstagramIcon, left: 378, top: 23, delay: '.9s', dur: '4.6s' },
  { Icon: DiamondSparkleIcon, left: 98, top: 530, delay: '.4s', dur: '5.2s' },
  { Icon: TelegramIcon, left: 441, top: 248, delay: '.3s', dur: '4.9s' },
  { Icon: ShopifyIcon, left: 193, top: 502, delay: '1.1s', dur: '5.4s' },
  { Icon: BurstSparkleIcon, left: 55, top: 448, delay: '.7s', dur: '4.4s' },
  { Icon: MessengerIcon, left: 469, top: 165, delay: '.5s', dur: '5.1s' },
];

const getSteps = (t: (key: string) => string) => [
  { label: t('signup_page.step1_label'), icon: User, title: t('signup_page.step1_title'), subtitle: t('signup_page.step1_subtitle'), dark: false },
  { label: t('signup_page.step2_label'), icon: Link2, title: t('signup_page.step2_title'), subtitle: t('signup_page.step2_subtitle'), dark: false },
  { label: t('signup_page.step3_label'), icon: WandIcon, title: t('signup_page.step3_title'), subtitle: t('signup_page.step3_subtitle'), dark: true },
];

const SignupPage: React.FC = () => {
  const { t } = useTranslation();
  const STEPS = getSteps(t);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isOpening, setIsOpening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();

  // Terms of Service / Privacy — must be accepted before signup is allowed.
  const [agreed, setAgreed] = useState(false);

  // Step 2 — email OTP verification. 'done' = verified, credentials emailed.
  const [step, setStep] = useState<'form' | 'otp' | 'done'>('form');
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (step !== 'otp' || resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, resendCooldown]);

  // Register lives ONLY on the central app host (app.agentawk.com) — a brand-new
  // agency has no subdomain yet. The marketing apex (agentawk.com) is a separate
  // site, and per-tenant subdomains show login, not signup. From any of those,
  // bounce the user to app.agentawk.com/signup. Dev hosts (localhost) stay open.
  useEffect(() => {
    if (isAppHost() || isDevHost()) return;
    window.location.href = appHostUrl('/signup');
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    setIsLoading(true);
    try {
      // Mirrors auth.service.ts register() — agency-level account creation.
      // No password field — one is generated + emailed once the OTP below is verified.
      await apiRequest('POST', '/auth/register', {
        firstName,
        lastName,
        agencyName: agencyName || `${firstName}'s Agency`,
        email,
      });

      setSuccessMessage(t('signup_page.verification_code_sent'));
      setStep('otp');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 0);
    } catch (error: any) {
      console.error('Signup error:', error);
      setErrorMessage(error?.message || t('signup_page.failed_to_create_account'));
    } finally {
      setIsLoading(false);
    }
  };

  const submitOtp = async (code: string) => {
    setOtpError('');
    setIsVerifying(true);
    try {
      await apiRequest('POST', '/auth/verify-signup-otp', { email, code });
      // Verified — do NOT bounce to /login (which, on the app host, redirects to
      // find-account). Show a clear "we've emailed your details" confirmation
      // and let the user go check their inbox.
      setOtpSuccess('');
      setStep('done');
    } catch (error: any) {
      console.error('OTP verify error:', error);
      setOtpError(error?.message || t('signup_page.invalid_or_expired_code'));
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      otpInputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);

    if (digit && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }

    if (next.every((d) => d !== '')) {
      submitOtp(next.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
    if (!digits.length) return;

    const next = Array(OTP_LENGTH).fill('');
    digits.forEach((d, i) => (next[i] = d));
    setOtpDigits(next);

    const lastFilledIndex = Math.min(digits.length, OTP_LENGTH) - 1;
    otpInputRefs.current[lastFilledIndex]?.focus();

    if (next.every((d) => d !== '')) {
      submitOtp(next.join(''));
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setOtpError('');
    try {
      await apiRequest('POST', '/auth/resend-signup-otp', { email });
      setOtpSuccess(t('signup_page.new_code_sent'));
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      otpInputRefs.current[0]?.focus();
    } catch (error: any) {
      setOtpError(error?.message || t('signup_page.failed_to_resend_code'));
    } finally {
      setIsResending(false);
    }
  };

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
        {/* Left Section — illustration (flex:1, fills remaining space) */}
        <div
          className={cn(
            'hidden lg:block flex-1 relative overflow-hidden z-10 transition-transform duration-500 ease-in-out',
            isOpening && '-translate-x-full'
          )}
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
              {t('signup_page.get_set_up_headline')}
            </div>
          </div>

          {/* floating channel/integration chips */}
          {FLOATING_ICONS.map(({ Icon, left, top, delay, dur }, i) => (
            <div
              key={i}
              className="absolute z-10 rounded-2xl bg-white flex items-center justify-center"
              style={{ left, top, width: 44, height: 44, boxShadow: '0 12px 26px -8px rgba(11,16,32,.18)', animation: `auth-drift ${dur} ease-in-out ${delay} infinite` }}
            >
              <Icon className="w-6 h-6" />
            </div>
          ))}

          {/* step rail */}
          <div className="absolute" style={{ left: 41, top: 128, width: 340 }}>
            <div className="absolute rounded-full" style={{ left: 20, top: 20, bottom: 20, width: 3, background: '#e4ece7' }} />
            <div className="relative flex flex-col" style={{ gap: 15 }}>
              {STEPS.map((s) => {
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

          {/* meta badge */}
          <div className="absolute z-10" style={{ left: 41, bottom: 24 }}>
            <div
              className="inline-flex items-center gap-2.5 rounded-full px-3.5 py-2"
              style={{ background: '#fff', boxShadow: '0 14px 32px -16px rgba(11,16,32,.4)' }}
            >
              <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 11, color: '#0084ff' }}>Meta</span>
              <span className="w-px h-3" style={{ background: '#e2e6ec' }} />
              <span className="inline-flex items-center gap-1.5" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 11, color: '#0B1020' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#25d366" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {t('signup_page.verified_tech_partner')}
              </span>
            </div>
          </div>
        </div>

        {/* Right Section — form (fixed width, matches ref) */}
        <div
          className={cn(
            'w-full lg:w-[600px] lg:shrink-0 flex items-center justify-center px-6 sm:px-12 py-6 z-10 transition-transform duration-500 ease-in-out overflow-hidden',
            isOpening && 'translate-x-full'
          )}
        >
          <div className="w-full max-w-lg">
            {step === 'done' ? (
              <div className="text-center">
                <div className="mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#eafaf0' }}>
                  <MailCheck className="w-8 h-8 text-[#1eb955]" />
                </div>
                <div className="uppercase mb-2.5" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 12, letterSpacing: '0.2em', color: '#25d366' }}>
                  {t('signup_page.account_created')}
                </div>
                <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 28, letterSpacing: '-0.02em', color: '#0B1020' }}>
                  {t('signup_page.check_your_email')}
                </h1>
                <p className="mt-3" style={{ fontSize: 15, lineHeight: 1.55, color: '#6b7482' }}>
                  {t('signup_page.details_sent_prefix')}{' '}
                  <span className="font-semibold" style={{ color: '#0B1020' }}>{email}</span>.
                  {' '}{t('signup_page.details_sent_suffix')}
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/find-account')}
                  className="mt-6 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                  style={{ color: '#1eb955' }}
                >
                  {t('signup_page.didnt_get_email')}
                </button>
              </div>
            ) : step === 'otp' ? (
              <>
                <div className="mb-8">
                  <div className="uppercase mb-2.5" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 12, letterSpacing: '0.2em', color: '#25d366' }}>
                    {t('signup_page.almost_there')}
                  </div>
                  <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 28, letterSpacing: '-0.02em', color: '#0B1020' }}>
                    {t('signup_page.verify_your_email')}
                  </h1>
                  <p className="mt-3" style={{ fontSize: 15, color: '#6b7482' }}>
                    {t('signup_page.enter_code_sent_to')} <span className="font-semibold" style={{ color: '#0B1020' }}>{email}</span>
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="flex gap-3">
                    {otpDigits.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => (otpInputRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        onPaste={handleOtpPaste}
                        disabled={isVerifying}
                        className="h-14 w-14 rounded-[10px] text-center text-2xl font-semibold outline-none border"
                        style={{ borderColor: '#D7D7D7', color: '#0B1020' }}
                      />
                    ))}
                  </div>

                  {otpError && <p className="text-sm text-red-500">{otpError}</p>}
                  {otpSuccess && !otpError && (
                    <p className="text-sm" style={{ color: '#1eb955' }}>{otpSuccess}</p>
                  )}

                  <button
                    type="button"
                    disabled={isVerifying || otpDigits.some((d) => !d)}
                    onClick={() => submitOtp(otpDigits.join(''))}
                    className="w-full h-[52px] rounded-[11px] border-none flex items-center justify-center gap-2 text-white disabled:opacity-60"
                    style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, background: '#22B257', boxShadow: '0 16px 34px -16px rgba(37,211,102,.7)' }}
                  >
                    {isVerifying ? t('signup_page.verifying') : t('signup_page.verify')}
                  </button>

                  <div className="text-center text-sm" style={{ color: '#6b7482' }}>
                    {resendCooldown > 0 ? (
                      <span>{t('signup_page.resend_code_in', { seconds: resendCooldown })}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={isResending}
                        className="font-semibold hover:underline disabled:opacity-50"
                        style={{ color: '#1eb955' }}
                      >
                        {isResending ? t('signup_page.resending') : t('signup_page.resend_code')}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setStep('form')}
                    className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                    style={{ color: '#1eb955' }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {t('signup_page.back')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <div className="uppercase mb-2.5" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 12, letterSpacing: '0.2em', color: '#25d366' }}>
                    {t('signup_page.get_started_free')}
                  </div>
                  <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 28, letterSpacing: '-0.02em', color: '#0B1020' }}>
                    {t('signup_page.great_to_have_you')}
                  </h1>
                  <p className="mt-2.5" style={{ fontSize: 14, lineHeight: 1.5, color: '#6b7482' }}>
                    {t('signup_page.reply_across_channels')}
                  </p>
                </div>

                <form onSubmit={handleSignup} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block relative">
                      <span className="absolute -top-[9px] left-[11px] bg-white px-1.5 z-10" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 12, color: '#33475b', lineHeight: 1 }}>
                        <span style={{ color: '#f2545b' }}>* </span>{t('signup_page.first_name')}
                      </span>
                      <Input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        maxLength={100}
                        className="w-full h-10 rounded-[6px] border-[#D7D7D7] px-3.5 focus-visible:ring-0"
                        style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 500, fontSize: 14, color: '#0B1020' }}
                      />
                    </label>
                    <label className="block relative">
                      <span className="absolute -top-[9px] left-[11px] bg-white px-1.5 z-10" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 12, color: '#33475b', lineHeight: 1 }}>
                        <span style={{ color: '#f2545b' }}>* </span>{t('signup_page.last_name')}
                      </span>
                      <Input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        maxLength={100}
                        className="w-full h-10 rounded-[6px] border-[#D7D7D7] px-3.5 focus-visible:ring-0"
                        style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 500, fontSize: 14, color: '#0B1020' }}
                      />
                    </label>
                  </div>

                  <label className="block relative">
                    <span className="absolute -top-[9px] left-[11px] bg-white px-1.5 z-10" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 12, color: '#33475b', lineHeight: 1 }}>
                      {t('signup_page.company_name')}
                    </span>
                    <Input
                      id="agencyName"
                      type="text"
                      value={agencyName}
                      onChange={(e) => setAgencyName(e.target.value)}
                      maxLength={100}
                      className="w-full h-10 rounded-[6px] border-[#D7D7D7] px-3.5 focus-visible:ring-0"
                      style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 500, fontSize: 14, color: '#0B1020' }}
                    />
                  </label>

                  <label className="block relative">
                    <span className="absolute -top-[9px] left-[11px] bg-white px-1.5 z-10" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 12, color: '#33475b', lineHeight: 1 }}>
                      <span style={{ color: '#f2545b' }}>* </span>{t('signup_page.work_email')}
                    </span>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      maxLength={250}
                      className="w-full h-10 rounded-[6px] border-[#D7D7D7] px-3.5 focus-visible:ring-0"
                      style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 500, fontSize: 14, color: '#0B1020' }}
                    />
                    {errorMessage && (
                      <p className="mt-1.5 text-sm text-red-500">{errorMessage}</p>
                    )}
                    {successMessage && (
                      <p className="mt-1.5 text-sm" style={{ color: '#1eb955' }}>{successMessage}</p>
                    )}
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-0.5 w-[15px] h-[15px] rounded-[4px] border-[#cfd6e0] text-[#25d366] focus:ring-[#25d366]"
                    />
                    <span style={{ fontSize: 12.5, color: '#6b7482' }}>
                      {t('signup_page.agree_to_terms_prefix')} <a href="#" style={{ color: '#1eb955', fontWeight: 600 }}>{t('signup_page.terms_of_service')}</a> {t('signup_page.and')}{' '}
                      <a href="#" style={{ color: '#1eb955', fontWeight: 600 }}>{t('signup_page.privacy_policy')}</a>.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={isLoading || !agreed}
                    title={!agreed ? t('signup_page.accept_terms_tooltip') : undefined}
                    className="w-full h-10 rounded-[11px] border-none flex items-center justify-center gap-2 text-white transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, background: '#22B257', boxShadow: '0 16px 34px -16px rgba(37,211,102,.7)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#1ea34e')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#22B257')}
                  >
                    {isLoading ? t('signup_page.creating_account') : (
                      <>
                        {t('signup_page.sign_up')} <ArrowRight className="h-4 w-4" strokeWidth={2.6} />
                      </>
                    )}
                  </button>
                  {!agreed && (
                    <p className="text-center" style={{ fontSize: 12, color: '#9aa4b5' }}>
                      {t('signup_page.accept_terms_notice')}
                    </p>
                  )}
                </form>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => navigate('/find-account')}
                    className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                    style={{ color: '#1eb955' }}
                  >
                    <Search className="h-4 w-4" />
                    {t('signup_page.find_my_account')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
