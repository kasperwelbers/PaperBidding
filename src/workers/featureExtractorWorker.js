import { pipeline, env } from "@xenova/transformers";

// Skip local model check
env.allowLocalModels = false;

// Use the Singleton pattern to enable lazy construction of the pipeline.
class PipelineSingleton {
  static task = "feature-extraction";
  static model = "Xenova/all-MiniLM-L6-v2";
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

self.addEventListener("message", async (event) => {
  let extractor;
  try {
    extractor = await PipelineSingleton.getInstance();
    if (event.data.type === "prepare-model") {
      return self.postMessage({
        type: "model-status",
        status: "ready",
      });
    }
  } catch (e) {
    return self.postMessage({
      type: "model-status",
      status: "error",
      error: e.message,
    });
  }

  try {
    let output = await extractor(event.data.text, {
      pooling: "mean",
      normalize: true,
    });
    return self.postMessage({
      type: "results",
      id: event.data.id,
      status: "ready",
      vector: output.data,
    });
  } catch (e) {
    return self.postMessage({
      type: "results",
      id: event.data.id,
      status: "error",
      vector: [],
    });
  }
});
