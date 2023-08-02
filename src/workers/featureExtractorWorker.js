import { pipeline, env } from "@xenova/transformers";

// Skip local model check
env.allowLocalModels = false;

// Use the Singleton pattern to enable lazy construction of the pipeline.
class PipelineSingleton {
  static task = "feature-extraction";
  static model = "Xenova/e5-small-v2";
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

self.addEventListener("message", async (event) => {
  let extractor = await PipelineSingleton.getInstance((x) => {
    self.postMessage({
      type: "model-status",
      status: x,
    });
  });

  let output = await extractor(event.data.text, {
    pooling: "mean",
    normalize: true,
  });

  self.postMessage({
    type: "results",
    id: event.data.id,
    output: output.data,
  });
});
