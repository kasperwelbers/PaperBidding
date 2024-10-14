"use client";

import { useProject } from "@/hooks/api";
import { SWRConfig } from "swr";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FaWindowClose } from "react-icons/fa";

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { project: number; reviewer?: number };
}) {
  const { data: project, isLoading, error } = useProject(params.project);
  const router = useRouter();

  useEffect(() => {
    if (error && error.message === "Not signed in") router.push("/");
  }, [error, router]);

  const projectName = project?.name || "";

  return (
    <div className="relative h-full">
      <header className="bg-primary flex justify-center">
        <div className="flex z-20 px-4 lg:px-10 py-1 max-w-7xl sticky top-0 w-full justify-center items-center  text-white">
          <div className="flex flex-col md:flex-row w-full justify-between">
            <div className="flex flex-wrap md:flex-col p-2 gap-x-3 justify-between ">
              <h5 className="m-0">{projectName.replaceAll("_", " ")}</h5>
              {/* <span className="italic">Project management</span> */}
            </div>
          </div>
          <Button
            className="p-0 m-0 w-min h-min hover:bg-transparent hover:text-white"
            size="icon"
            variant="ghost"
            onClick={() => router.push("/")}
          >
            <FaWindowClose size={24} />
          </Button>
        </div>
      </header>
      <div>
        <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
      </div>
    </div>
  );
}
