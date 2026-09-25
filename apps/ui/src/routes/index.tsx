import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleDot,
  GitBranch,
  Layers3,
  Search,
  ShieldCheck,
  Terminal,
  Timer,
  Waypoints,
  X,
} from 'lucide-react';
import { Button } from '~/components/ui/button';

export const Route = createFileRoute('/')({
  component: Home,
});

const capabilities = [
  ['Detect', 'Find latency, error and performance anomalies from real telemetry.'],
  ['Correlate', 'Connect the request, trace, span, service and surrounding evidence.'],
  ['Explain', 'Turn a detection into a reasoned investigation instead of another dashboard.'],
  ['Act', 'Keep the evidence attached to the finding so engineers can move from signal to fix.'],
] as const;

const workflow = [
  {
    number: '01',
    icon: Activity,
    title: 'Send OpenTelemetry',
    text: 'Instrument your services and send traces, logs and request telemetry into the project.',
  },
  {
    number: '02',
    icon: Search,
    title: 'Watch the system',
    text: 'SoonWhy builds service and trace context from the telemetry your applications already emit.',
  },
  {
    number: '03',
    icon: BrainCircuit,
    title: 'Investigate the signal',
    text: 'Detections preserve the evidence and relationships engineers need to understand the bottleneck.',
  },
];

function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F7FAF4] text-[#182012]">
      <header className="sticky top-0 z-40 border-b border-[#DDE6D9] bg-[#F7FAF4]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-[#182012] text-sm font-bold text-[#8BD125]">S</span>
            SoonWhy
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-[#182012]/65 md:flex">
            <a href="#product" className="hover:text-[#182012]">Product</a>
            <a href="#how-it-works" className="hover:text-[#182012]">How it works</a>
            <a href="#open-telemetry" className="hover:text-[#182012]">OpenTelemetry</a>
            <Link to="/auth/sign-in" className="hover:text-[#182012]">Sign in</Link>
          </nav>
          <Button asChild size="sm" className="bg-[#182012] text-white hover:bg-[#182012]/90">
            <Link to="/auth/sign-up">Start free <ArrowRight /></Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="border-b border-[#DDE6D9]">
          <div className="mx-auto grid max-w-6xl gap-14 px-5 pb-20 pt-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-28">
            <div>
              <div className="inline-flex items-center gap-2 border border-[#C9D8C5] bg-white px-3 py-1.5 text-xs font-semibold text-[#16931F]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#16931F]" />
                OpenTelemetry-native intelligent observability
              </div>
              <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-[4.5rem]">
                Know <span className="text-[#16931F]">why</span> your system is slow.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-[#182012]/65">
                SoonWhy turns traces, errors, logs and service context into evidence-backed performance investigations.
                Find the bottleneck, understand the relationship, and see what changed.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="bg-[#182012] text-white hover:bg-[#182012]/90">
                  <Link to="/auth/sign-up">Create your workspace <ArrowRight /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-[#BFD0B9] bg-white">
                  <Link to="/auth/sign-in">Open dashboard</Link>
                </Button>
              </div>
              <p className="mt-5 text-xs text-[#182012]/45">Built around OpenTelemetry. No new agent required.</p>
            </div>

            <div className="relative">
              <div className="absolute -inset-8 bg-[#C9E7EB]/30 blur-3xl" aria-hidden="true" />
              <div className="relative overflow-hidden border border-[#2A3524] bg-[#182012] shadow-[0_20px_60px_rgba(24,32,18,0.16)]">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-white/55">
                  <span>investigation / checkout-api</span>
                  <span className="flex items-center gap-1.5 text-[#8BD125]"><CircleDot className="h-3 w-3" /> live</span>
                </div>
                <div className="space-y-5 p-5">
                  <div>
                    <div className="flex items-center justify-between text-xs text-white/45">
                      <span>LATENCY P95</span><span>2.84s</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-white/10"><div className="h-full w-[82%] bg-[#8BD125]" /></div>
                  </div>
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border border-white/10 p-3">
                    <GitBranch className="h-4 w-4 text-[#8BD125]" />
                    <div><p className="text-sm text-white">checkout-api</p><p className="text-xs text-white/40">POST /checkout</p></div>
                    <span className="text-xs text-[#8BD125]">+61%</span>
                  </div>
                  <div className="space-y-2">
                    <SignalRow label="checkout-api" width="91%" value="2.41s" />
                    <SignalRow label="payments-client" width="68%" value="1.76s" />
                    <SignalRow label="postgres" width="38%" value="0.83s" />
                  </div>
                  <div className="border border-[#8BD125]/25 bg-[#8BD125]/5 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#8BD125]">Evidence</p>
                    <p className="mt-2 text-sm leading-6 text-white/80">Dominant span accounts for most request time and correlates with the downstream dependency.</p>
                  </div>
                </div>
              </div>
              <p className="relative mt-3 text-center text-xs text-[#182012]/40">A product surface, not a decorative dashboard mockup.</p>
            </div>
          </div>
        </section>

        <section id="product" className="border-b border-[#DDE6D9] bg-white">
          <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8 lg:py-24">
            <div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#16931F]">What SoonWhy does</p>
                <h2 className="mt-3 max-w-md text-3xl font-semibold tracking-[-.035em] sm:text-4xl">From a noisy signal to a useful explanation.</h2>
                <p className="mt-5 max-w-md leading-7 text-[#182012]/60">
                  Traditional observability helps you find the graph. SoonWhy is designed to help you follow the evidence through it.
                </p>
              </div>
              <div className="grid border-t border-[#DDE6D9] sm:grid-cols-2">
                {capabilities.map(([title, text], index) => (
                  <div key={title} className="border-b border-[#DDE6D9] py-6 sm:pr-8">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-[#16931F]">0{index + 1}</span>
                      <h3 className="font-semibold">{title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#182012]/60">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-b border-[#DDE6D9]">
          <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8 lg:py-24">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#16931F]">How it works</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Keep the workflow close to the engineer.</h2>
              </div>
              <Link to="/auth/sign-up" className="inline-flex items-center gap-1 text-sm font-semibold text-[#16931F] hover:underline">Start with a project <ChevronRight className="h-4 w-4" /></Link>
            </div>
            <div className="mt-12 grid border-y border-[#DDE6D9] md:grid-cols-3">
              {workflow.map(({ number, icon: Icon, title, text }) => (
                <div key={number} className="border-b border-[#DDE6D9] p-7 md:border-b-0 md:border-r last:border-r-0">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[#16931F]">{number}</span>
                    <Icon className="h-5 w-5 text-[#16931F]" />
                  </div>
                  <h3 className="mt-10 text-lg font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#182012]/60">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="open-telemetry" className="border-b border-[#DDE6D9] bg-[#182012] text-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-[.9fr_1.1fr] lg:px-8 lg:py-24">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#8BD125]">OpenTelemetry first</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Bring the telemetry you already have.</h2>
              <p className="mt-5 max-w-lg leading-7 text-white/60">
                SoonWhy is built around OpenTelemetry so instrumentation stays with your applications while investigation happens in one place.
              </p>
              <div className="mt-8 space-y-3 text-sm text-white/70">
                <CheckLine text="Trace-aware request investigations" />
                <CheckLine text="Service and dependency context" />
                <CheckLine text="Evidence linked back to source telemetry" />
                <CheckLine text="Project-scoped ingestion and access" />
              </div>
            </div>
            <div className="border border-white/10 bg-black/20">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 font-mono text-xs text-white/45">
                <Terminal className="h-3.5 w-3.5" /> your application
              </div>
              <div className="space-y-5 p-5 font-mono text-xs leading-6">
                <CodeLine dim="$ npm install @soonwhy/sdk" />
                <CodeLine dim="$ export SOONWHY_API_KEY=..." />
                <CodeLine dim="$ npm run start" />
                <div className="border-l border-[#8BD125] pl-4 text-white/55">
                  <p><span className="text-[#8BD125]">→</span> telemetry received</p>
                  <p><span className="text-[#8BD125]">→</span> trace indexed</p>
                  <p><span className="text-[#8BD125]">→</span> investigation ready</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#DDE6D9] bg-white">
          <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8 lg:py-24">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <MiniFeature icon={Waypoints} title="Trace context" text="Move from request to dominant span and downstream dependency." />
              <MiniFeature icon={Timer} title="Performance" text="Surface latency, error and bottleneck signals from real telemetry." />
              <MiniFeature icon={Layers3} title="Evidence" text="Keep source IDs and telemetry context attached to findings." />
              <MiniFeature icon={ShieldCheck} title="Project isolation" text="Keep organization and project telemetry scoped to the right workspace." />
            </div>
          </div>
        </section>

        <section className="border-b border-[#DDE6D9]">
          <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#16931F]">Built for investigation</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Your telemetry should tell a story.</h2>
                <p className="mt-5 leading-7 text-[#182012]/60">
                  A request starts the story. Its trace provides structure. Spans reveal where time went. Dependencies add context. SoonWhy keeps those relationships visible while you investigate.
                </p>
              </div>
              <div className="border border-[#DDE6D9] bg-white">
                {['Request', 'Trace', 'Dominant span', 'Dependency', 'Evidence-backed finding'].map((item, index) => (
                  <div key={item} className="flex items-center gap-4 border-b border-[#DDE6D9] p-4 last:border-b-0">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#E9F4E5] font-mono text-xs text-[#16931F]">{index + 1}</span>
                    <span className="text-sm font-medium">{item}</span>
                    {index < 4 && <ArrowRight className="ml-auto h-4 w-4 text-[#16931F]" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#EAF4E7]">
          <div className="mx-auto max-w-6xl px-5 py-20 text-center lg:px-8 lg:py-24">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#16931F]">Ready when you are</p>
            <h2 className="mx-auto mt-3 max-w-2xl text-4xl font-semibold tracking-[-.045em] sm:text-5xl">Stop asking what broke. Start asking why.</h2>
            <p className="mx-auto mt-5 max-w-xl leading-7 text-[#182012]/60">Create a project, connect OpenTelemetry, and investigate your first real signal.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-[#182012] text-white hover:bg-[#182012]/90">
                <Link to="/auth/sign-up">Create your workspace <ArrowRight /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-[#BFD0B9] bg-white">
                <Link to="/auth/sign-in">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#182012] text-white/55">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-2 text-white"><span className="grid h-7 w-7 place-items-center rounded-md bg-[#8BD125] text-xs font-bold text-[#182012]">S</span> SoonWhy</div>
          <div className="flex items-center gap-5"><Link to="/auth/sign-in" className="hover:text-white">Sign in</Link><Link to="/auth/sign-up" className="hover:text-white">Get started</Link></div>
        </div>
      </footer>
    </div>
  );
}

function SignalRow({ label, width, value }: { label: string; width: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr_44px] items-center gap-3 text-xs">
      <span className="truncate text-white/50">{label}</span>
      <div className="h-1 bg-white/10"><div className="h-full bg-[#8BD125]" style={{ width }} /></div>
      <span className="text-right text-white/60">{value}</span>
    </div>
  );
}

function CheckLine({ text }: { text: string }) {
  return <div className="flex items-center gap-3"><Check className="h-4 w-4 shrink-0 text-[#8BD125]" />{text}</div>;
}

function CodeLine({ dim }: { dim: string }) {
  return <div><span className="text-white/70">{dim}</span></div>;
}

function MiniFeature({ icon: Icon, title, text }: { icon: typeof Activity; title: string; text: string }) {
  return (
    <div className="border-t border-[#DDE6D9] pt-5">
      <Icon className="h-5 w-5 text-[#16931F]" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#182012]/55">{text}</p>
    </div>
  );
}
