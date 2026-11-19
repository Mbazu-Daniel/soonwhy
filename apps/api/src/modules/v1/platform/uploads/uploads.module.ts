import { Module } from "@nestjs/common";
import { ObjectStorageService } from "../../../../common/storage/object-storage.service";
import { UploadsController } from "./presentation/uploads.controller";
import { UploadsService } from "./application/uploads.service";

@Module({
  controllers: [UploadsController],
  providers: [ObjectStorageService, UploadsService],
})
export class UploadsModule {}
