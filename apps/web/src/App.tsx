import { useEffect, useState } from "react";
import { api } from "./api";

type Health = { ok: boolean; service: string } | "error" | null;

export default function App() {
  const [health, setHealth] = useState<Health>(null);

  useEffect(() => {
    api.health
      .$get()
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setHealth("error"));
  }, []);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Conference planner</h1>
      <p className="mt-2 text-gray-600">
        Match reviewers to submissions, with or without paper bidding.
      </p>
      <p className="mt-6 text-sm">
        API:{" "}
        {health === null
          ? "checking…"
          : health === "error" || !health.ok
            ? "not reachable"
            : "ok"}
      </p>
    </main>
  );
}
