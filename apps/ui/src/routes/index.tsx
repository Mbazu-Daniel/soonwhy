import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, type CSSProperties } from 'react';
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
    icon: BrainCircuit,
    title: 'AI root-cause analysis',
    text: 'Correlate latency, errors, logs, deployments and dependency context into an evidence-backed explanation of what changed and where the bottleneck started.',
  },
  {
    icon: Waypoints,
    title: 'Evidence stays connected',
    text: 'Follow one request from trace to span to dependency with the source telemetry attached instead of jumping between disconnected tools.',
  },
  {
    icon: Zap,
    title: 'From finding to fix',
    text: 'End with a concrete bottleneck and the evidence behind it, rather than another dashboard you still have to interpret yourself.',
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
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="landing-page min-h-screen overflow-x-hidden bg-[#080B07] text-white selection:bg-[#8BD125] selection:text-[#182012]">
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#080B07]/75 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-full h-px bg-gradient-to-r from-transparent via-[#8BD125]/40 to-transparent" />
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#8BD125] text-sm font-black text-[#182012]">S</span>
            <span className="display-font text-lg">SoonWhy</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-white/55 md:flex">
            <a href="#product" className="group relative transition-colors hover:text-white">Product<span className="absolute -bottom-2 left-0 h-px w-0 bg-[#8BD125] transition-all duration-300 group-hover:w-full" /></a>
            <a href="#logging" className="transition-colors hover:text-white">Logging</a>
            <a href="#open-telemetry" className="transition-colors hover:text-white">OpenTelemetry</a>
            <a href="#developers" className="transition-colors hover:text-white">Developers</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden text-white/70 hover:bg-white/5 hover:text-white sm:inline-flex">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="hidden bg-[#8BD125] font-semibold text-[#182012] hover:bg-[#9BE43A] sm:inline-flex">
              <Link to="/register">Start a project <ArrowRight /></Link>
            </Button>
            <button
              type="button"
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-white sm:hidden"
            >
              <span className="relative block h-4 w-4">
                <span className={`absolute left-0 top-1 h-px w-4 bg-current transition-transform duration-300 ${menuOpen ? 'translate-y-1.5 rotate-45' : ''}`} />
                <span className={`absolute left-0 top-2.5 h-px w-4 bg-current transition-opacity duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
                <span className={`absolute left-0 top-4 h-px w-4 bg-current transition-transform duration-300 ${menuOpen ? '-translate-y-1.5 -rotate-45' : ''}`} />
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className={`fixed inset-x-4 top-[4.5rem] z-40 origin-top rounded-2xl border border-white/10 bg-[#101610]/95 p-3 shadow-2xl backdrop-blur-xl transition-all duration-300 sm:hidden ${menuOpen ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-3 scale-95 pointer-events-none opacity-0'}`}>
        {[
          ['Product', '#product'],
          ['Logging', '#logging'],
          ['OpenTelemetry', '#open-telemetry'],
          ['Developers', '#developers'],
        ].map(([label, href]) => (
          <a key={href} href={href} onClick={() => setMenuOpen(false)} className="flex items-center justify-between rounded-xl px-4 py-3 text-sm text-white/65 transition-colors hover:bg-white/[0.05] hover:text-white">
            {label}
            <ChevronRight className="h-4 w-4 text-white/20" />
          </a>
        ))}
        <div className="mt-2 border-t border-white/[0.07] pt-2">
          <Link to="/login" onClick={() => setMenuOpen(false)} className="block rounded-xl px-4 py-3 text-sm text-white/65">Sign in</Link>
          <Link to="/register" onClick={() => setMenuOpen(false)} className="mt-1 flex items-center justify-between rounded-xl bg-[#8BD125] px-4 py-3 text-sm font-semibold text-[#182012]">
            Start a project <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <main>
        <section className="relative overflow-hidden border-b border-white/[0.07]">
          <AnimatedBackdrop />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_50%_0%,rgba(139,209,37,0.12),transparent_58%)]" />
          <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-24 text-center lg:px-8 lg:pb-28 lg:pt-32">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#8BD125]/25 bg-[#8BD125]/[0.06] px-3.5 py-1.5 text-xs font-medium text-[#B5E66A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8BD125] shadow-[0_0_12px_rgba(139,209,37,0.8)]" />
              OpenTelemetry-native intelligent observability
            </div>

            <h1 className="display-font mx-auto mt-8 max-w-5xl text-6xl leading-[0.9] sm:text-7xl lg:text-[7.1rem]">
              <CopyReveal words={["Know", "why", "your", "system", "is", "slow."]} accentFrom={3} />
            </h1>

            <p className="copy-fade mx-auto mt-7 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
              SoonWhy connects traces, logs, errors and service context to find the bottleneck and explain the evidence behind it.
            </p>

            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 bg-[#8BD125] px-6 font-semibold text-[#182012] hover:bg-[#9BE43A]">
                <Link to="/register">Start investigating <ArrowRight /></Link>
              </Button>
            </div>

            <p className="mt-5 text-xs text-white/30">Start with OpenTelemetry. Keep your existing instrumentation.</p>

            <div className="hero-product-card mx-auto mt-16 max-w-5xl overflow-hidden rounded-[22px] border border-white/10 bg-[#111711] text-left shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
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
                <h2 className="geom-font mt-4 text-4xl sm:text-5xl">From signal to explanation.</h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-white/45">
                  Observability gives you the data. SoonWhy keeps the relationships together so you can understand what is happening and why.
                </p>
              </div>
              <Link to="/register" className="inline-flex items-center gap-2 text-sm font-medium text-[#B5E66A] hover:text-[#D0F49A]">
                Start with a project <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-14">
              {features.map(({ icon: Icon, title, text }, index) => (
                <div key={title} className="feature-row editorial-line grid gap-6 py-8 md:grid-cols-[72px_1fr_1.15fr] md:items-center">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-[10px] text-white/25">0{index + 1}</span>
                    <Icon className="h-4 w-4 text-[#8BD125]" />
                  </div>
                  <h3 className="geom-font text-2xl sm:text-3xl">{title}</h3>
                  <p className="max-w-xl text-sm leading-7 text-white/40">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="logging" className="border-b border-white/[0.07] bg-[#0D120C] text-white">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-28">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8BD125]">Better logging</p>
                <h2 className="geom-font mt-4 text-4xl sm:text-5xl">Logs should tell the whole story.</h2>
                <p className="mt-5 max-w-lg leading-7 text-white/45">
                  SoonWhy treats logs as investigation data, not a stream of messages. Rich context, trace correlation and useful dimensions make every event easier to connect back to the request that produced it.
                </p>
                <Link to="/register" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-[#B5E66A] hover:text-[#D0F49A]">
                  Start a project <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="divide-y divide-white/10 border-y border-white/10">
                <LogPrinciple number="01" title="Wide, contextual events" text="Capture the request, service, deployment, outcome and business context together instead of scattering useful details across dozens of log lines." />
                <LogPrinciple number="02" title="Trace-aware by default" text="Keep trace and request identity attached so logs can be correlated with the exact request path across services." />
                <LogPrinciple number="03" title="Signal over noise" text="Prioritize errors, slow requests and meaningful context instead of treating every log line as equally valuable telemetry." />
              </div>
            </div>
          </div>
        </section>

        <section id="open-telemetry" className="border-b border-white/[0.07]">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-28">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8BD125]">OpenTelemetry first</p>
                <h2 className="geom-font mt-4 text-4xl sm:text-5xl">Use the instrumentation you already have.</h2>
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

        <section className="border-b border-white/[0.07] bg-[#080B07]">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-28">
            <div className="grid gap-14 lg:grid-cols-[0.7fr_1.3fr]">
              <div className="lg:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8BD125]">Root-cause analysis</p>
                <h2 className="geom-font mt-4 max-w-3xl text-4xl sm:text-5xl">The investigation ends with an explanation.</h2>
                <p className="mt-5 max-w-2xl leading-7 text-white/45">
                  SoonWhy combines telemetry signals into a causal path, then uses AI to summarize the strongest evidence behind the bottleneck so engineers can validate the finding instead of starting from a blank dashboard.
                </p>
              </div>

              <div className="editorial-line lg:col-span-2 grid gap-0 border-y border-white/10 md:grid-cols-5">
                {investigationSteps.map(({ label, detail, icon: Icon }, index) => (
                  <div key={label} className="relative border-b border-white/10 p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 sm:p-6">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-[#8BD125]">0{index + 1}</span>
                      <Icon className="h-4 w-4 text-[#8BD125]" />
                    </div>
                    <p className="mt-8 text-sm font-semibold">{label}</p>
                    <p className="mt-2 font-mono text-xs leading-5 text-white/30">{detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="developers" className="border-b border-white/[0.07]">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-28">
            <div className="editorial-line grid gap-8 py-8 sm:grid-cols-2 lg:grid-cols-4">
              <DeveloperFeature icon={Code2} title="Developer first" text="Built around real production investigation." />
              <DeveloperFeature icon={Database} title="Real telemetry" text="No invented charts or fabricated signals." />
              <DeveloperFeature icon={Layers3} title="Project context" text="Telemetry stays attached to the right project." />
              <DeveloperFeature icon={ShieldCheck} title="Evidence attached" text="Source IDs remain visible through the investigation." />
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#8BD125] text-[#182012]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_50%,rgba(255,255,255,0.2),transparent_36%)]" />
          <div className="relative mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-20 lg:flex-row lg:items-center lg:px-8 lg:py-24">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#182012]/55">Ready when you are</p>
              <h2 className="display-font mt-3 max-w-3xl text-4xl sm:text-5xl">Know why your system is slow.</h2>
              <p className="mt-4 max-w-xl leading-7 text-[#182012]/65">Create a project, connect OpenTelemetry, and investigate your first real signal.</p>
            </div>
            <Button asChild size="lg" className="h-12 shrink-0 bg-[#182012] px-6 text-white hover:bg-[#25311E]">
              <Link to="/register">Start investigating <ArrowRight /></Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="bg-[#080B07] text-white/45">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-10 lg:px-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <Link to="/" className="flex items-center gap-2 font-semibold text-white">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-[#8BD125] text-xs font-black text-[#182012]">S</span>
              <span className="display-font">SoonWhy</span>
            </Link>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/login" className="hover:text-white">Sign in</Link>
              <Link to="/register" className="hover:text-white">Start a project</Link>
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

function CopyReveal({ words, accentFrom = -1 }: { words: string[]; accentFrom?: number }) {
  return (
    <span className="copy-reveal" aria-label={words.join(' ')}>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className={`copy-reveal-word${index >= accentFrom ? ' accent' : ''}`}
          style={{ '--copy-index': index } as CSSProperties}
          aria-hidden="true"
        >
          {word}
        </span>
      ))}
    </span>
  );
}

function AnimatedBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-32 top-[-10rem] h-[32rem] w-[32rem] rounded-full bg-[#8BD125]/10 blur-[110px] animate-[float-orb_12s_ease-in-out_infinite]" />
      <div className="absolute right-[-10rem] top-16 h-[28rem] w-[28rem] rounded-full bg-[#C9E7EB]/[0.06] blur-[110px] animate-[float-orb-reverse_15s_ease-in-out_infinite]" />
      <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(139,209,37,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(139,209,37,0.12)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black_15%,transparent_72%)] animate-[grid-drift_18s_linear_infinite]" />
      <div className="absolute left-1/2 top-[42%] h-px w-[70vw] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#8BD125]/25 to-transparent animate-[scan-line_7s_ease-in-out_infinite]" />
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
    <div className="editorial-line grid gap-5 py-7 md:grid-cols-[72px_1fr_1.4fr] md:items-center">
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-xs text-[#8BD125]">{number}</span>
        <Icon className="h-5 w-5 text-[#8BD125]" />
      </div>
      <h3 className="geom-font text-2xl">{title}</h3>
      <p className="max-w-xl text-sm leading-7 text-white/40">{text}</p>
    </div>
  );
}

function InvestigationRow({ number, icon: Icon, title, text }: { number: string; icon: typeof BrainCircuit; title: string; text: string }) {
  return (
    <div className="grid gap-5 border-b border-white/10 py-8 sm:grid-cols-[48px_1fr]">
      <div className="flex items-start justify-between sm:block">
        <span className="font-mono text-[10px] text-[#8BD125]">{number}</span>
        <Icon className="h-4 w-4 text-[#8BD125] sm:mt-5" />
      </div>
      <div>
        <h3 className="geom-font text-2xl sm:text-3xl">{title}</h3>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/40">{text}</p>
      </div>
    </div>
  );
}

function LogPrinciple({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="grid gap-4 py-7 sm:grid-cols-[48px_1fr]">
      <span className="font-mono text-[10px] text-[#8BD125]">{number}</span>
      <div>
        <h3 className="geom-font text-2xl">{title}</h3>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/40">{text}</p>
      </div>
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
    <div className="feature-row">
      <Icon className="h-4 w-4 text-[#8BD125]" />
      <h3 className="geom-font mt-4 text-lg">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/40">{text}</p>
    </div>
  );
}

export default Home;
