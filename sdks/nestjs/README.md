# Soonwhy NestJS SDK

```ts
import { SoonwhyModule } from '@soonwhy/nestjs';
@Module({imports:[SoonwhyModule.forRoot({apiKey:process.env.SOONWHY_API_KEY!,serviceName:'api'})]})
export class AppModule {}
```

NestJS application shutdown is connected to the Node SDK.