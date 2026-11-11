import { Module } from "@nestjs/common";
import { MemberContextController } from "./member-context.controller";

@Module({
  controllers: [MemberContextController],
})
export class MemberContextModule {}
