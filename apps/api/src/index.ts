import { app } from "./app";

export default {
  fetch: app.fetch,

  // Import jobs (parsing, embeddings) arrive here in batches. Implemented in
  // phase 2 (see docs/conference-planner/plan.md, section 7)
  async queue(batch) {
    for (const message of batch.messages) {
      console.log("import message (not handled yet)", message.id);
      message.ack();
    }
  },
} satisfies ExportedHandler<Env>;
