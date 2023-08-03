"use client";

import { useCreateProject, useProjects } from "@/hooks/api";
import { useState } from "react";

export default function Create() {
  const { data, isLoading, isError } = useProjects();
  const { trigger: createProject } = useCreateProject();
  const [name, setName] = useState("");

  if (isLoading) return "loading";
  if (isError) return "error";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12">
      {data.projects.map((p) => {
        return <div>{p.name}</div>;
      })}

      <div>
        <button onClick={() => createProject({ name: "test" })}>
          create project
        </button>
      </div>
    </main>
  );
}
