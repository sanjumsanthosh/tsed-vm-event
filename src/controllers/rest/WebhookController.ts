import { Req } from "@tsed/common";
import { Controller } from "@tsed/di";
import { $log } from "@tsed/logger";
import { BodyParams } from "@tsed/platform-params";
import { Post } from "@tsed/schema";

@Controller("/webhook")
export class WebhookController {
  @Post("/")
  async post(@BodyParams() body: any, @Req() request: any) {
    $log.info({event: "WEBHOOK_RECEIVED", body: JSON.stringify(body)});
    return {
      status: "ok"
    };
  }
}