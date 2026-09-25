import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, Activity, BrainCircuit, GitBranch, ShieldCheck, Terminal } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-[#F7FAF4] text-[#182012]">
      <header className="border-b border-[#DBE5D7]/80 bg-[#F7FAF4]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#182012] text-[#8BD125]">S</span>
            SoonWhy
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost"><Link to="/auth/sign-in">Sign in</Link></Button>
            <Button asChild className="bg-[#182012] text-white hover:bg-[#182012]/90"><Link to="/auth/sign-up">Start free</Link></Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-5 pb-20 pt-16 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="max-w-4xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#C9D8C5] bg-white px-3 py-1.5 text-xs font-semibold text-[#16931F]">
              <Activity className="h-3.5 w-3.5" /> OpenTelemetry-native observability
            </p>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              Find the reason behind the signal.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#182012]/65">
              SoonWhy connects traces, errors, logs and service context to detect performance bottlenecks and explain what changed.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-[#182012] text-white hover:bg-[#182012]/90">
                <Link to="/auth/sign-up">Create your workspace <ArrowRight /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-[#BFD0B9] bg-white">
                <Link to="/auth/sign-in">Open dashboard</Link>
              </Button>
            </div>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-3">
            <Feature icon={GitBranch} title="Trace-aware" text="Move from a system signal to the trace and span that explain it." />
            <Feature icon={BrainCircuit} title="Evidence-backed" text="Detections preserve the telemetry evidence behind each finding." />
            <Feature icon={ShieldCheck} title="Tenant isolated" text="Projects and telemetry stay scoped to their organization." />
          </div>

          <Card className="mt-5 overflow-hidden border-[#C9D8C5] bg-[#182012] text-white shadow-none">
            <CardContent className="grid gap-8 p-7 md:grid-cols-[1fr_auto] md:items-center md:p-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8BD125]">From signal to explanation</p>
                <p className="mt-3 max-w-2xl text-xl font-medium leading-8 text-white/90">
                  Connect OpenTelemetry, choose a project, and start with the first useful signal instead of configuring a wall of dashboards.
                </p>
              </div>
              <Terminal className="hidden h-14 w-14 text-[#8BD125] md:block" />
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

function Feature({ icon: Icon, title, text }: { icon: typeof Activity; title: string; text: string }) {
  return (
    <Card className="border-[#DBE5D7] bg-white shadow-none">
      <CardContent className="p-6">
        <Icon className="h-5 w-5 text-[#16931F]" />
        <h2 className="mt-5 font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}
