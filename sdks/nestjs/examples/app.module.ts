import { Module } from '@nestjs/common';
import { SoonwhyModule } from '@soonwhy/nestjs';

@Module({
  imports: [
    SoonwhyModule.forRoot({
      apiKey: process.env.SOONWHY_API_KEY!,
      serviceName: 'example-nestjs-service',
    }),
  ],
})
export class AppModule {}
