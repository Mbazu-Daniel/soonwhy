import { Module } from "@nestjs/common";
import { ObjectStorageService } from "../../../common/storage/object-storage.service";
import { UploadsController } from "./uploads.controller";
import { UploadsService } from "./uploads.service";

@Module({
  controllers: [UploadsController],
  providers: [ObjectStorageService, UploadsService],
})
export class UploadsModule {}
