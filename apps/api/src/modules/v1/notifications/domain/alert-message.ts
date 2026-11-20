import {
  DEFAULT_SEVERITY_COLOR,
  DEFAULT_WINDOW_LABEL,
  MAX_FAILING_ROUTES,
  METRIC_PRESENTATION,
  OPERATOR_PHRASES,
  SEVERITY_COLORS,
} from "./alert-message.constants";
import type { AlertMessage, AlertMessageInput, MetricPresentation } from "./alert-message.types";

function presentationOf(metric: string): MetricPresentation {
  return METRIC_PRESENTATION[metric] ?? { label: metric, unit: "", decimals: 2 };
}

function format(value: unknown, presentation: MetricPresentation): string {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return String(value);
  const rounded = Number.isInteger(number) ? String(number) : number.toFixed(presentation.decimals);
  return `${rounded}${presentation.unit}`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function windowLabel(window?: string): string {
  return window ? `the last ${window}` : DEFAULT_WINDOW_LABEL;
}

export function buildAlertMessage(input: AlertMessageInput): AlertMessage {
  const presentation = presentationOf(input.metric);
  const current = format(input.value, presentation);
  const limit = format(input.threshold, presentation);
  const phrase = OPERATOR_PHRASES[input.operator] ?? input.operator;
  const bound = phrase.replace(/^is /, "");
  const severity = input.severity.toUpperCase();
  const routes = (input.failingRoutes ?? []).slice(0, MAX_FAILING_ROUTES);
  const when = input.firedAt.toUTCString();
  const project = input.projectName ? ` in ${input.projectName}` : "";

  const headline = `${presentation.label} ${phrase} ${limit}: now ${current}`;
  const title = `[${severity}] ${input.ruleName}${project}`;

  const lines = [
    headline,
    "",
    `Rule: ${input.ruleName}`,
    `Severity: ${input.severity}`,
    `Metric: ${presentation.label} (${input.metric})`,
    `Current value: ${current}`,
    `Threshold: ${bound} ${limit}`,
    `Measured over: ${windowLabel(input.window)}`,
    `Detected at: ${when}`,
  ];
  if (input.description) lines.push(`Condition: ${input.description}`);
  if (routes.length) {
    lines.push("", "Most failing endpoints:");
    for (const route of routes) lines.push(`  ${route.route}: ${route.failures} failed`);
  }
  if (input.findingUrl) lines.push("", `Investigate: ${input.findingUrl}`);
  lines.push("", "This alert also appears under Findings and will resolve on its own once the metric recovers.");

  const color = SEVERITY_COLORS[input.severity] ?? DEFAULT_SEVERITY_COLOR;
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#6b7280">${escapeHtml(label)}</td><td style="padding:6px 0;color:#111827"><strong>${escapeHtml(value)}</strong></td></tr>`;
  const routeRows = routes
    .map((route) => `<li style="margin:2px 0"><code>${escapeHtml(route.route)}</code> &mdash; ${route.failures} failed</li>`)
    .join("");
  const htmlBody = [
    `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto">`,
    `<div style="border-left:4px solid ${color};padding:8px 16px;margin-bottom:16px">`,
    `<div style="font-size:12px;letter-spacing:.06em;color:${color}"><strong>${escapeHtml(severity)} ALERT</strong></div>`,
    `<div style="font-size:18px;color:#111827;margin-top:4px"><strong>${escapeHtml(input.ruleName)}</strong>${escapeHtml(project)}</div>`,
    `<div style="font-size:15px;color:#374151;margin-top:6px">${escapeHtml(headline)}</div>`,
    `</div>`,
    `<table style="border-collapse:collapse;font-size:14px">`,
    row("Metric", presentation.label),
    row("Current value", current),
    row("Threshold", `${bound} ${limit}`),
    row("Measured over", windowLabel(input.window)),
    row("Detected at", when),
    input.description ? row("Condition", input.description) : "",
    `</table>`,
    routes.length
      ? `<div style="margin-top:16px;font-size:14px;color:#374151"><strong>Most failing endpoints</strong><ul style="padding-left:18px">${routeRows}</ul></div>`
      : "",
    input.findingUrl
      ? `<p style="margin-top:20px"><a href="${escapeHtml(input.findingUrl)}" style="background:${color};color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;font-size:14px">Investigate in Soonwhy</a></p>`
      : "",
    `<p style="font-size:12px;color:#6b7280;margin-top:24px">This alert also appears under Findings and resolves on its own once the metric recovers.</p>`,
    `</div>`,
  ].join("");

  return { title, body: lines.join("\n"), htmlBody };
}
