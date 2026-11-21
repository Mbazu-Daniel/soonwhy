export const SQL_MAX_LENGTH = 16_384;
export const SQL_PLACEHOLDER = "?";
export const SQL_TEXT_ATTRIBUTE_KEYS = ["db.query.text", "db.statement"];
export const SQL_SYSTEM_ATTRIBUTE_KEYS = ["db.system.name", "db.system", "db_system"];
export const DOUBLE_QUOTE_STRING_SYSTEMS = ["mysql", "mariadb"];

export const SQL_TOKEN_PATTERN = new RegExp(
  [
    String.raw`(?<block>/\*[\s\S]*?(?:\*/|$))`,
    String.raw`(?<line>--[^\n]*)`,
    String.raw`(?<dollar>\$(?<tag>\w*)\$[\s\S]*?(?:\$\k<tag>\$|$))`,
    String.raw`(?<single>[eEnNxXbB]?'(?:''|\\[\s\S]|[^'\\])*(?:'|$))`,
    String.raw`(?<double>"(?:""|[^"])*(?:"|$))`,
    String.raw`(?<hex>\b0[xX][0-9a-fA-F]+\b)`,
    String.raw`(?<number>\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)`,
    String.raw`(?<keyword>\b(?:true|false|null)\b)`,
  ].join("|"),
  "gi",
);
