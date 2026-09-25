import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { SocialButtons } from '~/components/auth/social-buttons';
import { signIn, setSessionToken } from '~/lib/auth-client';
import { OrganizationForm } from '~/components/auth/organization-form';
import { firstOrganization } from '~/lib/open-organization';
import { useProject } from '~/lib/project-context';

export const Route = createFileRoute('/login')({ component: SignIn });

function SignIn() {
  const navigate = useNavigate();
  const { setOrganization } = useProject();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); const [error, setError] = useState(''); const [pending, setPending] = useState(false);
  const [needsOrganization, setNeedsOrganization] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); setError(''); setPending(true);
    const result = await signIn(email.trim(), password);
    if (result.error) { setPending(false); setError(result.error.message); return; }
    if (result.data?.session.token) setSessionToken(result.data.session.token);
    const organization = await firstOrganization().catch(() => null);
    setPending(false);
    if (!organization) { setNeedsOrganization(true); return; }
    setOrganization(organization);
    void navigate({ to: '/$organizationSlug', params: { organizationSlug: organization.slug } });
  }

  if (needsOrganization) {
    return <AuthShell title="Create your organization" subtitle="Choose the organization name and the subdomain people will open."><OrganizationForm /></AuthShell>;
  }

  return <AuthShell title="Sign in to SoonWhy" subtitle="See what changed, where it changed, and why.">
    <SocialButtons />
    <div className="auth-divider"><span>or continue with email</span></div>
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div role="alert" className="auth-error">{error}</div>}
      <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" className="auth-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com" /></div>
      <div className="space-y-2"><Label htmlFor="password">Password</Label><div className="relative"><Input id="password" className="auth-input pr-11" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(v => !v)} className="auth-password-toggle">{showPassword ? <EyeOff /> : <Eye />}</button></div></div>
      <Button type="submit" className="h-11 w-full bg-[#8BD125] text-[#182012] hover:bg-[#9be33c]" disabled={pending}>{pending ? 'Signing in...' : <>Sign in <ArrowRight /></>}</Button>
    </form>
    <p className="auth-switch">New to SoonWhy? <Link to="/register">Create an account</Link></p>
  </AuthShell>;
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <div className="auth-page"><div className="auth-orbit auth-orbit-one" /><div className="auth-orbit auth-orbit-two" /><div className="auth-content">
    <Link to="/" className="auth-brand"><span className="auth-brand-mark">S</span><span>SoonWhy</span></Link>
    <div className="auth-panel"><div className="auth-kicker">INTELLIGENT OBSERVABILITY</div><h1 className="display-font auth-title">{title}</h1><p className="auth-subtitle">{subtitle}</p><div className="mt-8">{children}</div></div>
  </div></div>;
}