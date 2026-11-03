import { app } from "./app";
import { processImportMessage, type ImportMessage } from "./imports/process";

export default {
  fetch: app.fetch,

  // Import steps (see src/imports/process.ts). One message at a time per job;
  // a failed step marks the job as failed (it can be restarted)
  async queue(batch, env) {
    for (const message of batch.messages) {
      await processImportMessage(env, message.body as ImportMessage);
      message.ack();
    }
  },
} satisfies ExportedHandler<Env>;
