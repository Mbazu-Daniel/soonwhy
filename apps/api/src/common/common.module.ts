import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TenantContextMiddleware } from './middleware/tenant-context.middleware';
import { TenantGuard } from './middleware/tenant-context.guard';

@Module({
  providers: [TenantGuard],
  exports: [TenantGuard],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes(
        { path: 'organizations', method: RequestMethod.ALL },
        { path: 'organization/{*path}', method: RequestMethod.ALL },
      );
  }
}
