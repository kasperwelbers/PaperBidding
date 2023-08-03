"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ModelStatus, FeatureExtractorCallback } from "@/types";
import CallbackManager from "@/classes/CallbackManager";

interface FeatureExtractorOut {
  modelStatus: ModelStatus;
  prepareModel: () => void;
  extractFeatures: (
    texts: string[],
    callback: FeatureExtractorCallback
  ) => void;
}

export default function useFeatureExtractor(
  autoLoad?: boolean
): FeatureExtractorOut {
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const worker = useRef<Worker | null>(null);
  const callbackManager = useRef(
    new CallbackManager<FeatureExtractorCallback>()
  );

  console.log(callbackManager.current.callbacks.keys());

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(
        new URL("./featureExtractorWorker.js", import.meta.url),
        {
          type: "module",
        }
      );
    }

    worker.current.onmessage = (e) => {
      if (e.data.type === "prepare-model") {
        callbackManager.current.delete(e.data.callbackId);
        setModelStatus(e.data.status);
      }
      if (e.data.type === "extract") {
        const callback = callbackManager.current.pop(e.data.callbackId);
        callback(e.data.featureVectors);
      }
    };

    return () => {
      if (!worker.current) return;
      worker.current.terminate();
      worker.current = null;
    };
  }, [callbackManager]);

  const prepareModel = useCallback(() => {
    if (!worker.current?.postMessage) return;
    setModelStatus("loading");
    worker.current.postMessage({ type: "prepare-model" });
  }, [worker]);

  const extractFeatures = useCallback(
    (texts: string[], callback: FeatureExtractorCallback) => {
      if (!worker.current?.postMessage) return;
      const callbackId = callbackManager.current.set(callback);
      worker.current.postMessage({ type: "extract", texts, callbackId });
    },
    [worker, callbackManager]
  );

  if (autoLoad && modelStatus !== "ready") prepareModel();

  return { modelStatus, prepareModel, extractFeatures };
}
