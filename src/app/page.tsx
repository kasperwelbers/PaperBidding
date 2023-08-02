"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FaCheck } from "react-icons/fa";

interface Input {
  id: string;
  authors: string[];
  title: string;
  abstract: string;
}
interface Result {
  status: "processing" | "ready" | "error";
  vector: number[];
}
type ModelStatus = "idle" | "loading" | "ready" | "error";

export default function Upload() {
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [results, setResults] = useState<Record<string, Result>>({});
  const [referenceText, setReferenceText] = useState<string>("");
  const [referenceScores, setReferenceScores] = useState<
    Record<string, number>
  >({});
  const worker = useRef<Worker | null>(null);
  const inputs: Input[] = [
    {
      id: "1623455",
      authors: ["Anna", "Bob"],
      title: "sports",
      abstract: "This is a text about sports",
    },
    {
      id: "2543534",
      authors: ["Claire"],
      title: "football one",
      abstract: "I really don't like football",
    },
    {
      id: "3353454",
      authors: ["Anna", "David"],
      title: "football two",
      abstract: "But many people do like football",
    },
    {
      id: "4534534",
      authors: ["Emma", "Frank"],
      title: "Food",
      abstract: "I like food better",
    },
    {
      id: "5634534",
      authors: ["Claire", "Frank"],
      title: "Pancakes",
      abstract: "Suddenly craving pancakes",
    },
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      if (worker.current)
        worker.current.postMessage({ id: "reference", text: referenceText });
    });
    return () => clearTimeout(timer);
  }, [referenceText, worker, modelStatus]);

  // We use the `useEffect` hook to set up the worker as soon as the `App` component is mounted.
  useEffect(() => {
    if (!worker.current) {
      // Create the worker if it does not yet exist.
      worker.current = new Worker(
        new URL("../workers/featureExtractorWorker.js", import.meta.url),
        {
          type: "module",
        }
      );
    }

    worker.current.onmessage = (e) => {
      if (e.data.type === "model-status") {
        setModelStatus(e.data.status);
      } else {
        setResults((results) => ({
          ...results,
          [e.data.id]: { status: e.data.status, vector: e.data.vector },
        }));
      }
    };

    return () => {
      if (!worker.current) return;
      worker.current.terminate();
      worker.current = null;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const newReferenceScores: Record<string, number> = {};
      const reference = results["reference"];
      if (!reference?.vector || reference.vector.length === 0) return;
      for (let key of Object.keys(results)) {
        if (key === "reference") continue;
        const current = results[key];
        if (current?.status !== "ready") continue;
        const score = cosineSimilarity(current.vector, reference.vector);
        newReferenceScores[key] = score;
      }
      setReferenceScores(newReferenceScores);
    });
    return () => clearTimeout(timer);
  }, [results]);

  const prepareModel = useCallback(() => {
    if (!worker.current?.postMessage) return;
    setModelStatus("loading");
    worker.current.postMessage({ type: "prepare-model" });
  }, [worker]);

  const processInputs = useCallback(
    (inputs: Input[]) => {
      setResults((results) => {
        if (!worker.current) return results;
        const newResults = { ...results };
        for (let input of inputs) {
          const current = results[input.id];
          if (current?.status === "processing") continue;
          if (current?.status === "ready") continue;
          worker.current.postMessage({
            type: "process",
            id: input.id,
            text: input.title + "\n\n" + input.abstract,
          });
          newResults[input.id] = {
            status: "processing",
            vector: [],
          };
        }
        return newResults;
      });
    },
    [inputs, worker]
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12">
      <h1 className="text-5xl font-bold mb-2 text-center">Paper Bidding</h1>
      <h2 className="text-2xl mb-10 text-center">
        Test case for running transformer-based semantic similarity in browser
      </h2>

      <div key="inputs" className="grid grid-cols-2 gap-3">
        <div className="font-bold text-3xl text-center ">Input</div>
        <div>
          <div className="font-bold text-3xl text-center">Reference text</div>
          <div className="">
            <input
              value={referenceText}
              className="w-full rounded p-1 m-2"
              placeholder="type reference text"
              onChange={(e) => setReferenceText(e.target.value)}
            />
          </div>
        </div>
        {inputs.map((input, i) => {
          return (
            <div key={input.id + i} className="contents text-center">
              <div className="grid  grid-cols-[10em,1fr]">
                <div className="font-bold">{input.id} </div>
                <h3 className="font-bold">{input.title} </h3>
                <div className="italic">{input.authors.join(", ")} </div>
                <p>{input.abstract} </p>
              </div>
              <div className={`text-green-700`}>
                {Math.round(referenceScores[input.id] * 100) / 100 || ""}
              </div>{" "}
            </div>
          );
        })}
      </div>
      <div className="pt-10">
        {modelStatus === "ready" ? (
          <button
            className="bg-slate-700 text-white p-3 rounded w-40"
            onClick={() => processInputs(inputs)}
          >
            Process texts
          </button>
        ) : (
          <button
            className="bg-slate-700 text-white p-3 rounded w-40"
            onClick={() => prepareModel()}
          >
            {modelStatus === "idle" ? "load model" : ""}
            {modelStatus === "loading" ? "loading..." : ""}
            {modelStatus === "error" ? "Error :(" : ""}{" "}
          </button>
        )}
      </div>
    </main>
  );
}

function cosineSimilarity(a: number[], b: number[]) {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
