import { useEffect, useState } from 'react';
import { Github } from 'lucide-react';
import { getAuthProviders, getSocialSignInUrl, type AuthProviders } from '~/lib/auth-client';

function GoogleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M21.35 12.23c0-.7-.06-1.37-.18-2.02H12v3.82h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.19Z"/><path fill="#34A853" d="M12 21.9c2.63 0 4.84-.87 6.45-2.35l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.75 9.75 0 0 0 12 21.9Z"/><path fill="#FBBC05" d="M6.54 13.99A5.86 5.86 0 0 1 6.24 12c0-.69.12-1.36.3-1.99V7.48H3.3A9.76 9.76 0 0 0 2.25 12c0 1.57.38 3.05 1.05 4.52l3.24-2.53Z"/><path fill="#EA4335" d="M12 5.98c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.83 3.03 14.63 2.1 12 2.1a9.75 9.75 0 0 0-8.7 5.38l3.24 2.53C7.31 7.7 9.46 5.98 12 5.98Z"/></svg>;
}

export function SocialButtons() {
  const [providers, setProviders] = useState<AuthProviders | null>(null);

  useEffect(() => { void getAuthProviders().then(setProviders); }, []);

  const googleEnabled = providers?.google ?? false;
  const githubEnabled = providers?.github ?? false;

  return (
    <div className="space-y-3">
      {googleEnabled ? (
        <a href={getSocialSignInUrl('google')} className="auth-social-button"><GoogleIcon /><span>Continue with Google</span></a>
      ) : (
        <button type="button" disabled className="auth-social-button cursor-not-allowed opacity-50"><GoogleIcon /><span>Continue with Google</span></button>
      )}
      {githubEnabled ? (
        <a href={getSocialSignInUrl('github')} className="auth-social-button"><Github className="h-5 w-5" aria-hidden="true" /><span>Continue with GitHub</span></a>
      ) : (
        <button type="button" disabled className="auth-social-button cursor-not-allowed opacity-50"><Github className="h-5 w-5" aria-hidden="true" /><span>Continue with GitHub</span></button>
      )}
    </div>
  );
}