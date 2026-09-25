import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { SocialButtons } from '~/components/auth/social-buttons';
import { setSessionToken, signUp } from '~/lib/auth-client';

export const Route = createFileRoute('/auth/sign-up')({ component: SignUp });

function SignUp() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); const [error, setError] = useState(''); const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); setError(''); setPending(true);
    const result = await signUp(email.trim(), password); setPending(false);
    if (result.error) { setError(result.error.message); return; }
    if (result.data?.session.token) { setSessionToken(result.data.session.token); navigate({ to: '/organizations' }); return; }
    navigate({ to: '/login' });
  }

  return <div className="auth-page"><div className="auth-orbit auth-orbit-one" /><div className="auth-orbit auth-orbit-two" /><div className="auth-content">
    <Link to="/" className="auth-brand"><span className="auth-brand-mark">S</span><span>SoonWhy</span></Link>
    <div className="auth-panel"><div className="auth-kicker">INTELLIGENT OBSERVABILITY</div><h1 className="display-font auth-title">Start investigating</h1><p className="auth-subtitle">Instrument your systems. Connect the evidence. Know why they are slow.</p><div className="mt-8">
      <SocialButtons />
      <div className="auth-divider"><span>or continue with email</span></div>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div role="alert" className="auth-error">{error}</div>}
        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" className="auth-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com" /></div>
        <div className="space-y-2"><Label htmlFor="password">Password</Label><div className="relative"><Input id="password" className="auth-input pr-11" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(v => !v)} className="auth-password-toggle">{showPassword ? <EyeOff /> : <Eye />}</button></div><p className="auth-hint">Use at least 8 characters.</p></div>
        <Button type="submit" className="h-11 w-full bg-[#8BD125] text-[#182012] hover:bg-[#9be33c]" disabled={pending}>{pending ? 'Creating account...' : <>Create account <ArrowRight /></>}</Button>
      </form>
    </div><p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p></div>
  </div></div>;
}