const SPAN_KIND_SERVER = 2;
export const SPAN_KIND_CLIENT = 3;
export const SPAN_KIND_PRODUCER = 4;
const SPAN_KIND_CONSUMER = 5;
const SPAN_ERROR_STATUS_CODE = 2;

export const REQUEST_SPAN_FILTER = `(spanKind:${SPAN_KIND_SERVER} OR spanKind:${SPAN_KIND_CONSUMER} OR parentSpanId:"")`;
export const ERROR_SPAN_FILTER = `statusCode:${SPAN_ERROR_STATUS_CODE}`;
export const FAILED_REQUEST_FILTER = `(${ERROR_SPAN_FILTER} OR httpStatusCode:>=400)`;
