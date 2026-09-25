import { useEffect, useState } from 'react';
import { Github } from 'lucide-react';
import { getAuthProviders, getSocialSignInUrl, type AuthProviders } from '~/lib/auth-client';

export function SocialButtons() {
  const [providers, setProviders] = useState<AuthProviders | null>(null);

  useEffect(() => {
    void getAuthProviders().then(setProviders);
  }, []);

  if (!providers || (!providers.google && !providers.github)) return null;

  return (
    <div className="space-y-3">
      {providers.google && (
        <a
          href={getSocialSignInUrl('google')}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-[#D8E2D3] bg-white px-4 text-sm font-medium text-[#182012] transition-colors hover:bg-[#F7FAF4]"
        >
          <span className="grid h-5 w-5 place-items-center text-sm font-bold">G</span>
          Continue with Google
        </a>
      )}
      {providers.github && (
        <a
          href={getSocialSignInUrl('github')}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-[#D8E2D3] bg-white px-4 text-sm font-medium text-[#182012] transition-colors hover:bg-[#F7FAF4]"
        >
          <Github className="h-4 w-4" />
          Continue with GitHub
        </a>
      )}
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-[#D8E2D3]" />
      <span>or continue with email</span>
      <span className="h-px flex-1 bg-[#D8E2D3]" />
    </div>
  );
}
