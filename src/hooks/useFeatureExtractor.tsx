'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ModelStatus, FeatureExtractorCallback, ProgressCallback } from '@/types';
import CallbackManager from '@/classes/CallbackManager';

interface FeatureExtractorOut {
  modelStatus: ModelStatus;
  prepareModel: () => void;
  extractFeatures: (texts: string[], callback: FeatureExtractorCallback) => void;
}

export default function useFeatureExtractor(autoLoad?: boolean): FeatureExtractorOut {
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle');
  const worker = useRef<Worker | null>(null);
  const callbackManager = useRef(
    new CallbackManager<FeatureExtractorCallback | ProgressCallback>()
  );

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL('./featureExtractorWorker.js', import.meta.url), {
        type: 'module'
      });
    }

    worker.current.onmessage = (e) => {
      if (e.data.type === 'prepare-model') {
        callbackManager.current.delete(e.data.callbackId);
        setModelStatus(e.data.status);
      }
      if (e.data.type === 'extract') {
        const callback = callbackManager.current.pop(e.data.callbackId);
        callback?.(e.data.featureVectors);
      }
      if (e.data.type === 'progress') {
        const callback = callbackManager.current.get(e.data.callbackId);
        if (e.data.percent === 1) {
          callbackManager.current.delete(e.data.callbackId);
        }
        callback?.(e.data.percent);
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
    setModelStatus('loading');
    worker.current.postMessage({ type: 'prepare-model' });
  }, [worker]);

  const extractFeatures = useCallback(
    (texts: string[], onComplete: FeatureExtractorCallback, onProgress?: ProgressCallback) => {
      if (!worker.current?.postMessage) return;
      const callbackId = callbackManager.current.set(onComplete);
      const progressCallbackId = onProgress ? callbackManager.current.set(onProgress) : undefined;
      worker.current.postMessage({ type: 'extract', texts, callbackId, progressCallbackId });
    },
    [worker, callbackManager]
  );

  if (autoLoad && modelStatus === 'idle') prepareModel();

  return { modelStatus, prepareModel, extractFeatures };
}
