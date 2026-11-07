export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  metadata?: {
    detectionIds?: string[];
    sloIds?: string[];
    serviceName?: string;
  };
}

export interface ChatResponse {
  id: string;
  role: "assistant";
  content: string;
  timestamp: Date;
  suggestions?: string[];
  relatedEntities?: {
    detections?: Array<{ id: string; type: string; severity: string }>;
    slos?: Array<{ id: string; target: number; status: string }>;
  };
}

export type UserIntent =
  | "detect_anomaly_details"
  | "slo_burn_rate_status"
  | "change_point_analysis"
  | "detection_recommendations"
  | "general_health"
  | "unknown";

export const CHAT_RESPONSES = {
  greeting:
    "Hello! I can help you monitor your systems. You can ask me about detection anomalies, SLO burn rates, or get recommendations based on your metrics.",

  detection_anomaly: (detection: any) =>
    `I found a *${detection.severity}* detection for *${detection.type}*. Title: ${detection.title}. Observed value: ${detection.observedValue} ${detection.unit}. Description: ${detection.description}`,

  slo_burn_rate: (slo: any) =>
    `SLO Status: *${slo.status}*. Burn rate: ${slo.burnRate}x the allowed rate. Budget remaining: ${slo.budgetRemaining}%.`,

  change_point_analysis: (cpr: any) =>
    `Change point detection found ${cpr.changePoints.length} change points. Penalty used: ${cpr.penaltyUsed.toFixed(2)}.`,

  recommendations: (recs: string[]) =>
    `Based on your current metrics, here are some recommendations:\n` +
    recs.map((r, i) => `${i + 1}. ${r}`).join("\n"),

  unknown:
    "I'm not sure I understand. Could you rephrase or ask about detection anomalies, SLO burn rates, or system health?",
};

export async function handleChatMessage(
  message: string,
  orgId: string,
  detectionService?: any,
  sloService?: any,
): Promise<ChatResponse> {
  const lowerMessage = message.toLowerCase();
  const intent = classifyIntent(lowerMessage);
  const now = new Date();

  if (
    intent === "unknown" &&
    /(hello|hi|hey|thanks|thank you)/i.test(message)
  ) {
    return {
      id: "msg_" + Date.now(),
      role: "assistant",
      content: CHAT_RESPONSES.greeting,
      timestamp: now,
      suggestions: [
        "Ask about detection anomalies",
        "Check SLO burn rate",
        "Look for change points",
      ],
    };
  }

  if (intent === "detect_anomaly_details") {
    return {
      id: "msg_" + Date.now(),
      role: "assistant",
      content: CHAT_RESPONSES.unknown,
      timestamp: now,
      suggestions: ["Ask about detection anomalies", "Check SLO burn rate"],
    };
  }

  if (intent === "slo_burn_rate_status" && sloService) {
    return {
      id: "msg_" + Date.now(),
      role: "assistant",
      content: CHAT_RESPONSES.unknown,
      timestamp: now,
      suggestions: ["Check SLO configuration"],
    };
  }

  if (intent === "change_point_analysis") {
    return {
      id: "msg_" + Date.now(),
      role: "assistant",
      content:
        "I can help analyze change points in your time series data. This uses PELT-approximate detection to find structural breaks. Would you like me to run detection on a specific metric?",
      timestamp: now,
      suggestions: [
        "Run detection on latency",
        "Run detection on error rate",
        "Explain change-point analysis",
      ],
    };
  }

  if (intent === "detection_recommendations") {
    return {
      id: "msg_" + Date.now(),
      role: "assistant",
      content: CHAT_RESPONSES.recommendations([
        "Review recent deployments for change points",
        "Check seasonal patterns in your metrics",
        "Adjust alert thresholds if burn rate is high",
        "Consider increasing your SLO error budget",
      ]),
      timestamp: now,
      suggestions: ["Show me current detections", "Check SLO status"],
    };
  }

  if (intent === "general_health") {
    return {
      id: "msg_" + Date.now(),
      role: "assistant",
      content:
        "I can help you monitor your system health! I have access to detection anomalies, SLO burn rates, and change-point analysis. What would you like to know about?",
      timestamp: now,
      suggestions: [
        "Check detection anomalies",
        "SLO burn rate status",
        "Change point analysis",
      ],
    };
  }

  return {
    id: "msg_" + Date.now(),
    role: "assistant",
    content: CHAT_RESPONSES.unknown,
    timestamp: now,
    suggestions: [
      "Ask about detection anomalies",
      "Check SLO burn rate",
      "Look for change points",
    ],
  };
}

function classifyIntent(message: string): UserIntent {
  const detectionKeywords = [
    "anomaly",
    "detection",
    "alert",
    "seasonal",
    "change point",
  ];
  const hasDetection = detectionKeywords.some((kw) => message.includes(kw));

  const sloKeywords = ["slo", "burn rate", "error budget", "availability"];
  const hasSLO = sloKeywords.some((kw) => message.includes(kw));

  const recKeywords = ["recommend", "fix", "resolve"];
  const hasRec = recKeywords.some((kw) => message.includes(kw));

  const healthKeywords = ["health", "status", "what's happening"];
  const hasHealth = healthKeywords.some((kw) => message.includes(kw));

  if (hasHealth) return "general_health";
  if (hasSLO) return "slo_burn_rate_status";
  if (hasRec) return "detection_recommendations";
  if (hasDetection) return "detect_anomaly_details";

  return "unknown";
}
