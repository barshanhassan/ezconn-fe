import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../lib/queryClient';

/**
 * Cross-subdomain sign-in handoff. When an agency opens one of its workspaces,
 * that workspace lives on a DIFFERENT subdomain (a different browser origin), so
 * the agency tab's localStorage token can't carry over. The opener sends a
 * workspace-scoped token in the URL *fragment* (#token=...&next=...) — the
 * fragment is never sent to any server or written to server logs. This page
 * stores that token for the workspace origin, loads the user, cleans the URL,
 * and drops the user into the app already signed in.
 */
const SsoHandoffPage: React.FC = () => {
  const { t } = useTranslation();
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const raw = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(raw);
      const token = params.get('token');
      const next = params.get('next') || '/workspace';

      if (!token) {
        setError(t('sso_handoff_page.missing_token'));
        setTimeout(() => {
          window.location.href = '/login';
        }, 1200);
        return;
      }

      localStorage.setItem('auth_token', token);
      try {
        const res = await apiRequest('GET', '/auth/au');
        const data = await res.json();
        if (data?.user) {
          localStorage.setItem('user_info', JSON.stringify(data.user));
        }
      } catch {
        // Token is already stored; if the profile call fails the app can still
        // recover on the next authenticated request.
      }

      // Remove the token from the URL/history before entering the app.
      window.history.replaceState({}, document.title, window.location.pathname);
      window.location.href = next;
    })();
  }, []);

  return (
    <div
      className="h-screen w-full flex items-center justify-center bg-white"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      <div className="text-center">
        <div className="mx-auto mb-4 w-10 h-10 rounded-full border-2 border-[#25d366] border-t-transparent animate-spin" />
        <p style={{ color: error ? '#ef4444' : '#6b7482', fontSize: 15 }}>
          {error || t('sso_handoff_page.signing_in')}
        </p>
      </div>
    </div>
  );
};

export default SsoHandoffPage;
