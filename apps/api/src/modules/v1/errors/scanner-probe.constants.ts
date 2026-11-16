export const SCANNER_PROBE_STATUS = "HTTP 404";

export const SCANNER_PROBE_PATTERNS: readonly RegExp[] = [
  /\/\.(git|svn|hg|env|npmrc|git-credentials|ds_store|aws|ssh|htaccess|htpasswd)(\b|\/|\.|-|$)/i,
  /\/\.git\.bak\b|\/(old|backup|www|html|public)\/\.git\b/i,
  /\.map$/i,
  /\/(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lock|composer\.(json|lock)|gemfile(\.lock)?|pipfile(\.lock)?|requirements\.txt|go\.(sum|mod))$/i,
  /\/(vendor|node_modules|wp-admin|wp-content|wp-includes|wp-login\.php|phpmyadmin|cgi-bin|telescope|_ignition|storage\/logs|reconx-[0-9a-f]+)(\/|$)/i,
  /\/(sitemap\.xml|robots\.txt|xmlrpc\.php|phpinfo\.php|config\.php|\.well-known\/security\.txt)$/i,
  /\/(actuator|debug|console|server-status|solr|jenkins|manager\/html)(\/|$)/i,
];
