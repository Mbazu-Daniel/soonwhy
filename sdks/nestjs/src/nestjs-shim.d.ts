declare module '@nestjs/common' {
  export interface DynamicModule {
    module: Type<unknown>;
    global?: boolean;
    providers?: unknown[];
    exports?: unknown[];
  }

  export interface OnApplicationShutdown {
    onApplicationShutdown(signal?: string): unknown | Promise<unknown>;
  }

  export interface Type<T> extends Function {
    new (...args: any[]): T;
  }

  export function Global(): ClassDecorator;
  export function Inject(token: unknown): ParameterDecorator;
  export function Module(metadata: unknown): ClassDecorator;
}
