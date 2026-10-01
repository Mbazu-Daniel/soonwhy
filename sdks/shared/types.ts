export type AttributeValue=string|number|boolean|null|AttributeValue[]|{[key:string]:AttributeValue};
export type Attributes=Record<string,AttributeValue>;
export type LogLevel='trace'|'debug'|'info'|'warn'|'error'|'fatal';
export interface Resource{serviceName?:string;serviceVersion?:string;deploymentEnvironment?:string;attributes?:Attributes}
export interface LogRecord{level?:LogLevel;message:string;timestamp?:Date|number;attributes?:Attributes;traceId?:string;spanId?:string}
export interface ErrorRecord{error:unknown;timestamp?:Date|number;attributes?:Attributes;traceId?:string;spanId?:string}
export interface MetricRecord{name:string;value:number;unit?:string;timestamp?:Date|number;attributes?:Attributes}
export interface SdkOptions extends Resource{apiKey:string;endpoint?:string;batchSize?:number;flushIntervalMs?:number;maxRetries?:number}
export interface Sdk{captureLog(input:LogRecord):void;captureError(input:ErrorRecord):void;captureMetric(input:MetricRecord):void;flush():Promise<{sent:number;dropped:number}>;close():Promise<{sent:number;dropped:number}>}