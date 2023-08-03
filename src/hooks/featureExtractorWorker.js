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
  if (event.data.type === "prepare-model") {
    try {
      await PipelineSingleton.getInstance();
      return self.postMessage({
        type: "prepare-model",
        status: "ready",
      });
    } catch (e) {
      return self.postMessage({
        type: "prepare-model",
        status: "error",
      });
    }
  }

  if (event.data.type === "extract") {
    try {
      const extractor = await PipelineSingleton.getInstance();
      const featureVectors = [];
      for (let text of event.data.texts) {
        let output = await extractor(text, {
          pooling: "mean",
          normalize: true,
        });
        featureVectors.push(output.data);
      }
      return self.postMessage({
        type: "extract",
        status: "ready",
        featureVectors,
        callbackId: event.data.callbackId,
      });
    } catch (e) {
      return self.postMessage({
        type: "extract",
        status: "error",
        featureVectors: undefined,
        callbackId: event.data.callbackId,
      });
    }
  }
});
