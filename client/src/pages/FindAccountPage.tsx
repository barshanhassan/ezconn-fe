import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Input } from '../components/ui/input';
import { ArrowRight, MailCheck, Search } from 'lucide-react';
import { apiRequest } from '../lib/queryClient';
import { useTranslation } from 'react-i18next';

const BotMark: React.FC<{ className?: string; fill?: string }> = ({ className, fill = '#25d366' }) => (
  <svg viewBox="0 0 40 52" className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M6 3 H34 A4 4 0 0 1 38 7 V17 A4 4 0 0 1 34 21 H6 A4 4 0 0 1 2 17 V7 A4 4 0 0 1 6 3 Z M11 12 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 Z M22.6 12 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 Z" fill={fill} />
    <rect x="4" y="25" width="32" height="5.5" rx="2" fill={fill} />
    <rect x="16.5" y="30" width="7" height="20" rx="2" fill={fill} />
  </svg>
);

const FindAccountPage: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);
    try {
      // Backend always returns the same success shape (anti-enumeration), so we
      // never reveal whether the email exists — we just confirm an email was sent.
      await apiRequest('POST', '/auth/find-account', { email });
      setSent(true);
    } catch (error: any) {
      console.error('Find account error:', error);
      setErrorMessage(error?.message || t('find_account_page.generic_error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-white flex flex-col" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* top nav */}
      <div className="flex items-center justify-between px-6 lg:px-10 py-5 border-b border-[#f0f2f5] shrink-0">
        <button type="button" onClick={() => navigate('/login')} className="flex items-center gap-2 cursor-default">
          <BotMark className="h-6 w-auto" />
          <span className="text-xl" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: '0.01em', color: '#0B1020' }}>
            agen<span className="text-[#25d366]">t</span><span className="text-[#25d366]">awk</span>
          </span>
        </button>
      </div>

      <div className="flex flex-1 min-h-0 items-center justify-center px-6">
        <div className="w-full max-w-md">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-5 w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#eafaf0' }}>
                <MailCheck className="w-7 h-7 text-[#1eb955]" />
              </div>
              <h2 className="mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 28, letterSpacing: '-0.02em', color: '#0B1020' }}>
                {t('find_account_page.check_your_email')}
              </h2>
              <p style={{ fontSize: 15, lineHeight: 1.55, color: '#6b7482' }}>
                {t('find_account_page.email_sent_description_prefix')} <b>{email}</b>{t('find_account_page.email_sent_description_suffix')}
              </p>
              <button
                type="button"
                onClick={() => { setSent(false); setEmail(''); }}
                className="mt-6 text-sm"
                style={{ color: '#1eb955', fontWeight: 600 }}
              >
                {t('find_account_page.use_different_email')}
              </button>
            </div>
          ) : (
            <>
              <div className="mx-auto mb-5 w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#eafaf0' }}>
                <Search className="w-6 h-6 text-[#1eb955]" />
              </div>
              <div className="uppercase mb-2.5 text-center" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 12, letterSpacing: '0.2em', color: '#25d366' }}>
                {t('find_account_page.find_my_account')}
              </div>
              <h2 className="mb-2 text-center" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 30, letterSpacing: '-0.02em', color: '#0B1020', lineHeight: 1.15 }}>
                {t('find_account_page.where_do_i_log_in')}
              </h2>
              <p className="mb-8 text-center" style={{ fontSize: 15, lineHeight: 1.55, color: '#6b7482' }}>
                {t('find_account_page.instructions')}
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <label className="block relative">
                  <span className="absolute -top-[9px] left-[11px] bg-white px-1.5 z-10" style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 12, color: '#33475b', lineHeight: 1 }}>
                    <span style={{ color: '#f2545b' }}>* </span>{t('find_account_page.email_label')}
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
                  {errorMessage && <p className="mt-1.5 text-sm text-red-500">{errorMessage}</p>}
                </label>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-[52px] rounded-[11px] border-none flex items-center justify-center gap-2 text-white transition-colors disabled:opacity-70"
                  style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, background: '#22B257', boxShadow: '0 16px 34px -16px rgba(37,211,102,.7)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1ea34e')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#22B257')}
                >
                  {isLoading ? t('find_account_page.sending') : (<>{t('find_account_page.email_me_my_login_links')} <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.6} /></>)}
                </button>
              </form>

              <p className="text-center mt-6" style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: '#6b7482' }}>
                {t('find_account_page.new_to_agentawk')}{' '}
                <button type="button" onClick={() => navigate('/signup')} style={{ color: '#1eb955', fontWeight: 600 }}>
                  {t('find_account_page.create_an_account')}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FindAccountPage;
