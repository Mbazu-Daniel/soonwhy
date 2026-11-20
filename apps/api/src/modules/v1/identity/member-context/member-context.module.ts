import { Module } from "@nestjs/common";
import { MemberContextController } from "./presentation/member-context.controller";

@Module({
  controllers: [MemberContextController],
})
export class MemberContextModule {}
