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
type ModelStatus = "idle" | "loading" | "ready";

export default function Upload() {
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [results, setResults] = useState<Record<string, Result>>({});
  const worker = useRef(null);

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
      title: "programming",
      abstract: "Programming is more my kind of things",
    },
    {
      id: "5634534",
      authors: ["Claire", "Frank"],
      title: "frontend",
      abstract: "Currently playing around with frontend stuff",
    },
  ];

  // We use the `useEffect` hook to set up the worker as soon as the `App` component is mounted.
  useEffect(() => {
    if (!worker.current) {
      // Create the worker if it does not yet exist.
      worker.current = new Worker(
        new URL("../../workers/featureExtractorWorker.js", import.meta.url),
        {
          type: "module",
        }
      );
    }

    worker.current.onmessage = (e) => {
      if (e.data.type === "model-status") {
        if (e.data.status === "ready") setModelStatus("ready");
      } else {
        setResults((results) => ({
          ...results,
          [e.data.id]: { status: "ready", vector: e.data.result },
        }));
      }
    };

    worker.current.onerror = () => {
      setResults((results) => ({
        ...results,
        [e.data.id]: { status: "error", vector: [] },
      }));
    };

    return () => {
      worker.current.terminate();
      worker.current = null;
    };
  }, []);

  const processInputs = useCallback((inputs: Input[]) => {
    if (modelStatus === "idle") setModelStatus("loading");
    setResults((results) => {
      const newResults = { ...results };
      for (let input of inputs) {
        const current = results[input];
        if (current?.status === "processing") continue;
        if (current?.status === "ready") continue;
        worker.current.postMessage({
          id: input.id,
          text: input.title + "\n\n" + input.abstract,
        });
        newResults[input] = { status: "processing", vector: [] };
      }
      return newResults;
    });
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12">
      <h1 className="text-5xl font-bold mb-2 text-center">Transformers.js</h1>
      <h2 className="text-2xl mb-4 text-center">Next.js template</h2>

      <div key="inputs" className="grid grid-cols-2 gap-3">
        {inputs.map((input, i) => {
          return (
            <div key={input + i} className="contents">
              <div className="grid  grid-cols-[10em,1fr]">
                <div className="font-bold">{input.id} </div>
                <h3 className="font-bold">{input.title} </h3>
                <div className="italic">{input.authors.join(", ")} </div>
                <p>{input.abstract} </p>
              </div>
              <div className={`text-green-700`}>
                {results[input.id]?.status}
              </div>{" "}
            </div>
          );
        })}
      </div>
      <div className="p-4">
        <button
          className="bg-slate-700 text-white p-3 rounded"
          onClick={() => processInputs(inputs)}
        >
          Process texts
        </button>
      </div>
    </main>
  );
}

interface TextToVectorProps {
  setVector: (vector: number[]) => void;
}

function TextToVector({ setVector }: TextToVectorProps) {
  return (
    <input
      className="w-full max-w-xs p-2 border border-gray-300 rounded mb-4"
      type="text"
      placeholder="Enter text here"
      onInput={(e) => {
        classify(e.target.value);
      }}
    />
  );
}
