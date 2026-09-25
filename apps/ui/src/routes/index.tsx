import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleDot,
  Code2,
  Database,
  GitBranch,
  Layers3,
  Search,
  Server,
  ShieldCheck,
  Terminal,
  Timer,
  Waypoints,
  Zap,
} from 'lucide-react';
import { Button } from '~/components/ui/button';

export const Route = createFileRoute('/')({
  component: Home,
});

const features = [
  {
    icon: Search,
    title: 'Detect what changed',
    text: 'Find latency, error and performance anomalies from the telemetry your applications already emit.',
  },
  {
    icon: Waypoints,
    title: 'Follow the evidence',
    text: 'Move from request to trace, span and dependency without losing the context between them.',
  },
  {
    icon: BrainCircuit,
    title: 'Understand why',
    text: 'Turn a signal into an evidence-backed bottleneck investigation instead of another dashboard.',
  },
  {
    icon: Zap,
    title: 'Move to a fix',
    text: 'Keep the source telemetry and relationships attached to the finding so the next action is clear.',
  },
];

const investigationSteps = [
  { label: 'Request', detail: 'POST /checkout', icon: Activity },
  { label: 'Trace', detail: '4f8c...91a2', icon: GitBranch },
  { label: 'Dominant span', detail: 'payments.authorize', icon: Timer },
  { label: 'Dependency', detail: 'payments-api', icon: Server },
  { label: 'Finding', detail: 'Latency bottleneck', icon: BrainCircuit },
];

function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0B0F0A] text-white selection:bg-[#8BD125] selection:text-[#182012]">
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#0B0F0A]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#8BD125] text-sm font-black text-[#182012]">S</span>
            SoonWhy
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-white/55 md:flex">
            <a href="#product" className="transition-colors hover:text-white">Product</a>
            <a href="#how-it-works" className="transition-colors hover:text-white">How it works</a>
            <a href="#open-telemetry" className="transition-colors hover:text-white">OpenTelemetry</a>
            <a href="#developers" className="transition-colors hover:text-white">Developers</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden text-white/70 hover:bg-white/5 hover:text-white sm:inline-flex">
              <Link to="/auth/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="bg-[#8BD125] font-semibold text-[#182012] hover:bg-[#9BE43A]">
              <Link to="/auth/sign-up">Get started <ArrowRight /></Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-white/[0.07]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_50%_0%,rgba(139,209,37,0.12),transparent_58%)]" />
          <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-24 text-center lg:px-8 lg:pb-28 lg:pt-32">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#8BD125]/25 bg-[#8BD125]/[0.06] px-3.5 py-1.5 text-xs font-medium text-[#B5E66A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8BD125] shadow-[0_0_12px_rgba(139,209,37,0.8)]" />
              OpenTelemetry-native intelligent observability
            </div>

            <h1 className="mx-auto mt-8 max-w-5xl text-6xl font-semibold leading-[0.95] tracking-[-0.065em] sm:text-7xl lg:text-[6.6rem]">
              Know why your
              <br />
              <span className="text-[#8BD125]">system is slow.</span>
            </h1>

            <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
              SoonWhy connects traces, logs, errors and service context to find the bottleneck and explain the evidence behind it.
            </p>

            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 bg-[#8BD125] px-6 font-semibold text-[#182012] hover:bg-[#9BE43A]">
                <Link to="/auth/sign-up">Start investigating <ArrowRight /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 border-white/15 bg-white/[0.03] px-6 text-white hover:bg-white/[0.07] hover:text-white">
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>

            <p className="mt-5 text-xs text-white/30">Start with OpenTelemetry. Keep your existing instrumentation.</p>

            <div className="mx-auto mt-16 max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#111711] text-left shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                </div>
                <span className="font-mono text-[11px] text-white/30">soonwhy / investigation</span>
                <span className="flex items-center gap-1.5 text-[11px] text-[#8BD125]">
                  <CircleDot className="h-3 w-3" /> live telemetry
                </span>
              </div>

              <div className="grid lg:grid-cols-[1fr_300px]">
                <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r lg:p-7">
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">Investigation</p>
                      <h2 className="mt-2 text-xl font-semibold">checkout-api</h2>
                      <p className="mt-1 font-mono text-xs text-white/35">POST /checkout · trace 4f8c...91a2</p>
                    </div>
                    <span className="rounded-full border border-[#8BD125]/20 bg-[#8BD125]/[0.07] px-2.5 py-1 text-[10px] font-medium text-[#B5E66A]">DETECTED</span>
                  </div>

                  <div className="mt-7 grid gap-3 sm:grid-cols-3">
                    <Metric label="Latency p95" value="2.84s" change="+61%" />
                    <Metric label="Error rate" value="4.2%" change="+2.1%" />
                    <Metric label="Requests" value="18.4k" change="24h" />
                  </div>

                  <div className="mt-7 space-y-3">
                    <Signal label="checkout-api" value="2.41s" width="91%" />
                    <Signal label="payments-api" value="1.76s" width="68%" />
                    <Signal label="postgres" value="0.83s" width="38%" />
                  </div>
                </div>

                <div className="bg-black/15 p-5 lg:p-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8BD125]">Evidence</p>
                  <p className="mt-3 text-sm font-medium leading-6 text-white/85">
                    payments.authorize is the dominant span in the affected request path.
                  </p>
                  <div className="mt-5 space-y-3">
                    <Evidence label="Dominant span" value="payments.authorize" />
                    <Evidence label="Dependency" value="payments-api" />
                    <Evidence label="Duration" value="1.76s · 62%" />
                  </div>
                  <div className="mt-6 border-l border-[#8BD125]/60 pl-3 text-xs leading-5 text-white/45">
                    Correlated with elevated downstream latency in the same trace window.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="border-b border-white/[0.07]">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-28">
            <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8BD125]">First-class investigation</p>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">From signal to explanation.</h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-white/45">
                  Observability gives you the data. SoonWhy keeps the relationships together so you can understand what is happening and why.
                </p>
              </div>
              <Link to="/auth/sign-up" className="inline-flex items-center gap-2 text-sm font-medium text-[#B5E66A] hover:text-[#D0F49A]">
                Start with a project <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-14 grid overflow-hidden rounded-2xl border border-white/10 bg-[#111711] md:grid-cols-2 lg:grid-cols-4">
              {features.map(({ icon: Icon, title, text }, index) => (
                <div key={title} className="border-b border-white/10 p-7 md:border-r md:last:border-r-0 lg:border-b-0">
                  <div className="flex items-center justify-between">
                    <Icon className="h-5 w-5 text-[#8BD125]" />
                    <span className="font-mono text-[10px] text-white/25">0{index + 1}</span>
                  </div>
                  <h3 className="mt-10 text-lg font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/40">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-b border-white/[0.07] bg-[#F7FAF4] text-[#182012]">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-28">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#16931F]">How it works</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">One signal. One investigation.</h2>
              <p className="mt-5 max-w-xl leading-7 text-[#182012]/55">
                The workflow stays close to the way engineers actually debug production systems.
              </p>
            </div>

            <div className="mt-14 grid overflow-hidden rounded-2xl border border-[#D8E1D4] bg-white md:grid-cols-3">
              <Step number="01" icon={Terminal} title="Send telemetry" text="Use OpenTelemetry to send traces, logs and request context into your project." />
              <Step number="02" icon={Activity} title="Detect the signal" text="SoonWhy surfaces latency, error and performance changes from real application telemetry." />
              <Step number="03" icon={BrainCircuit} title="Investigate why" text="Follow the request, dominant span and dependency to the evidence behind the bottleneck." />
            </div>
          </div>
        </section>

        <section id="open-telemetry" className="border-b border-white/[0.07]">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-28">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8BD125]">OpenTelemetry first</p>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Use the instrumentation you already have.</h2>
                <p className="mt-5 max-w-lg leading-7 text-white/45">
                  SoonWhy sits on top of OpenTelemetry instead of asking you to replace your application instrumentation.
                </p>
                <div className="mt-8 space-y-3 text-sm text-white/60">
                  <CheckLine text="OTLP-native telemetry flow" />
                  <CheckLine text="Trace-aware request investigations" />
                  <CheckLine text="Service and dependency context" />
                  <CheckLine text="Evidence linked to source telemetry" />
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111711]">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                  <div className="flex items-center gap-2 text-xs text-white/40">
                    <Terminal className="h-4 w-4" /> quick start
                  </div>
                  <span className="rounded-full bg-[#8BD125]/10 px-2 py-1 font-mono text-[10px] text-[#B5E66A]">NODE</span>
                </div>
                <div className="p-5 font-mono text-xs leading-7 sm:p-7">
                  <p className="text-white/35">$ npm install @soonwhy/sdk</p>
                  <p className="mt-2 text-white/35">$ export SOONWHY_API_KEY=...</p>
                  <p className="mt-2 text-white/35">$ npm run start</p>
                  <div className="mt-6 space-y-1 border-l border-[#8BD125]/50 pl-4 text-white/45">
                    <p><span className="text-[#8BD125]">→</span> telemetry received</p>
                    <p><span className="text-[#8BD125]">→</span> trace indexed</p>
                    <p><span className="text-[#8BD125]">→</span> signal detected</p>
                    <p><span className="text-[#8BD125]">→</span> investigation ready</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[0.07] bg-[#111711]">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-28">
            <div className="grid gap-14 lg:grid-cols-[0.7fr_1.3fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8BD125]">It just works</p>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">The path from request to root cause.</h2>
              </div>

              <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
                {investigationSteps.map(({ label, detail, icon: Icon }, index) => (
                  <div key={label} className="flex items-center gap-4 p-5 sm:p-6">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#8BD125]/[0.08] text-[#8BD125]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="mt-1 truncate font-mono text-xs text-white/35">{detail}</p>
                    </div>
                    {index < investigationSteps.length - 1 && (
                      <ArrowRight className="ml-auto hidden h-4 w-4 text-white/20 sm:block" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="developers" className="border-b border-white/[0.07]">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-28">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <DeveloperFeature icon={Code2} title="Developer first" text="A workflow designed around engineers investigating real production signals." />
              <DeveloperFeature icon={Database} title="Real telemetry" text="No invented charts. Empty states stay honest until your project has data." />
              <DeveloperFeature icon={Layers3} title="Project context" text="Keep telemetry, investigations and access scoped to the right project." />
              <DeveloperFeature icon={ShieldCheck} title="Evidence attached" text="Source IDs and relationships remain visible throughout the investigation." />
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#8BD125] text-[#182012]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_50%,rgba(255,255,255,0.28),transparent_40%)]" />
          <div className="relative mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-20 lg:flex-row lg:items-center lg:px-8 lg:py-24">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#182012]/55">Ready when you are</p>
              <h2 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Know why your system is slow.</h2>
              <p className="mt-4 max-w-xl leading-7 text-[#182012]/65">Create a project, connect OpenTelemetry, and investigate your first real signal.</p>
            </div>
            <Button asChild size="lg" className="h-12 shrink-0 bg-[#182012] px-6 text-white hover:bg-[#25311E]">
              <Link to="/auth/sign-up">Start investigating <ArrowRight /></Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="bg-[#080B07] text-white/45">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-10 lg:px-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <Link to="/" className="flex items-center gap-2 font-semibold text-white">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-[#8BD125] text-xs font-black text-[#182012]">S</span>
              SoonWhy
            </Link>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/auth/sign-in" className="hover:text-white">Sign in</Link>
              <Link to="/auth/sign-up" className="hover:text-white">Get started</Link>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-2 border-t border-white/[0.07] pt-6 text-xs sm:flex-row">
            <span>OpenTelemetry-native intelligent observability.</span>
            <span>Built for engineers who need to know why.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Metric({ label, value, change }: { label: string; value: string; change: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/10 p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-white/30">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="text-lg font-semibold">{value}</span>
        <span className="font-mono text-[10px] text-[#8BD125]">{change}</span>
      </div>
    </div>
  );
}

function Signal({ label, value, width }: { label: string; value: string; width: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr_45px] items-center gap-3 text-xs">
      <span className="truncate text-white/40">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full bg-[#8BD125]" style={{ width }} />
      </div>
      <span className="text-right font-mono text-white/45">{value}</span>
    </div>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] pb-3 text-xs last:border-0 last:pb-0">
      <span className="text-white/30">{label}</span>
      <span className="text-right text-white/65">{value}</span>
    </div>
  );
}

function Step({ number, icon: Icon, title, text }: { number: string; icon: typeof Terminal; title: string; text: string }) {
  return (
    <div className="border-b border-[#D8E1D4] p-7 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-[#16931F]">{number}</span>
        <Icon className="h-5 w-5 text-[#16931F]" />
      </div>
      <h3 className="mt-12 text-lg font-semibold">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[#182012]/55">{text}</p>
    </div>
  );
}

function CheckLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <Check className="h-4 w-4 shrink-0 text-[#8BD125]" />
      <span>{text}</span>
    </div>
  );
}

function DeveloperFeature({ icon: Icon, title, text }: { icon: typeof Code2; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#111711] p-6">
      <Icon className="h-5 w-5 text-[#8BD125]" />
      <h3 className="mt-5 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/40">{text}</p>
    </div>
  );
}

export default Home;
