import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { signIn, setSessionToken } from '~/lib/auth-client';

export const Route = createFileRoute('/auth/sign-in')({ component: SignIn });

function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setPending(true);
    const result = await signIn(email.trim(), password);
    setPending(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (result.data?.session.token) setSessionToken(result.data.session.token);
    const returnPath = typeof window !== 'undefined' ? localStorage.getItem('soonwhy:return-path') : null;
    if (returnPath && returnPath.startsWith('/')) {
      localStorage.removeItem('soonwhy:return-path');
      navigate({ to: returnPath as '/' });
      return;
    }
    navigate({ to: '/organizations' });
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue investigating your systems.">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">{error}</div>}
        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" /></div>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><Label htmlFor="password">Password</Label></div>
          <div className="relative">
            <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="pr-11" />
            <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff /> : <Eye />}</button>
          </div>
        </div>
        <Button type="submit" className="h-11 w-full bg-[#182012] text-white hover:bg-[#182012]/90" disabled={pending}>{pending ? 'Signing in...' : <>Sign in <ArrowRight /></>}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">New to SoonWhy? <Link to="/auth/sign-up" className="font-medium text-[#16931F] hover:underline">Create an account</Link></p>
    </AuthShell>
  );
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7FAF4] px-4 py-8">
      <div className="mx-auto max-w-md">
        <Link to="/" className="mx-auto flex w-fit items-center gap-2 text-sm font-semibold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#182012] text-[#8BD125]">S</span> SoonWhy</Link>
        <div className="mt-10 rounded-2xl border border-[#DBE5D7] bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}
