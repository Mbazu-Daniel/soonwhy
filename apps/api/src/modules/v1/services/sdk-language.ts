const LANGUAGES: Record<string, string> = {
  nodejs: "Node.js",
  webjs: "JavaScript",
  python: "Python",
  java: "Java",
  go: "Go",
  dotnet: ".NET",
  ruby: "Ruby",
  php: "PHP",
  rust: "Rust",
  cpp: "C++",
  swift: "Swift",
  erlang: "Erlang",
  kotlin: "Kotlin",
};

export function languageFromSdk(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  return key ? (LANGUAGES[key] ?? null) : null;
}
