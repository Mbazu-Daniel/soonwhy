export const URL_ATTRIBUTE_KEYS = ["url.full", "http.url", "url.query", "http.target", "url.path"] as const;
export const QUERY_SECRET_PARAM = /([?&;])([^=&#;]*(?:token|secret|password|passwd|api[-_]?key|access[-_]?key|signature|session|auth|credential|code)[^=&#;]*)=[^&#;]*/gi;
