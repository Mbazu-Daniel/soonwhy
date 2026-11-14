import { Logger, Module, OnModuleInit } from "@nestjs/common";
import { inArray } from "drizzle-orm";
import { db } from "../../../common/db";
import { users } from "../../../common/db/schema/auth";
import { PlatformAdminController } from "./platform-admin.controller";

@Module({
  controllers: [PlatformAdminController],
})
export class PlatformAdminModule implements OnModuleInit {
  private readonly logger = new Logger("PlatformAdminModule");

  async onModuleInit() {
    await this.seed(process.env.SOONWHY_STAFF_EMAILS, "admin");
    await this.seed(process.env.SOONWHY_SUPER_ADMIN_EMAILS, "super_admin");
  }

  private async seed(list: string | undefined, role: "admin" | "super_admin") {
    const emails = (list ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    if (emails.length === 0) return;

    try {
      const updated = await db
        .update(users)
        .set({ platformRole: role })
        .where(inArray(users.email, emails))
        .returning({ id: users.id });
      this.logger.log(
        `SOONWHY_STAFF_EMAILS(${role}) applied to ${updated.length}/${emails.length} email(s) (existing rows only)`,
      );
    } catch (error) {
      this.logger.warn(
        `SOONWHY_STAFF_EMAILS(${role}) could not be applied: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
