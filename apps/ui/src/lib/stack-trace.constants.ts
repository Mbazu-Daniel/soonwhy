export const CAUSE_MARKER = /^Caused by:\s*/;
export const NODE_FRAME = /^at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/;
export const NODE_FRAME_NO_POSITION = /^at\s+(?:(.+?)\s+\()?(.+?)\)?$/;
export const FIREFOX_FRAME = /^(.*?)@(.+?):(\d+):(\d+)$/;
export const LIBRARY_PATH = /(?:^|[\\/])node_modules[\\/]/;
export const INTERNAL_PATH = /^(?:node:|internal\/|native\b|<anonymous>)/;
