"use client";

import { useProject } from "@/hooks/api";
import { SWRConfig } from "swr";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, use } from "react";
import { FaBackward, FaWindowClose } from "react-icons/fa";
import { Loading } from "@/components/ui/loading";

export default function ProjectLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ project: number; reviewer?: number }>;
  }
) {
  const params = use(props.params);

  const {
    children
  } = props;

  const session = useSession();
  const { data: project, isLoading, error } = useProject(params.project);
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (error && error.message === "Not signed in") router.push("/");
  }, [error, router]);

  const projectName = project?.name || "";

  const subPage = path.includes("/manage/");
  function goBack() {
    if (subPage) {
      router.push(`/projects/${params.project}/manage`);
      return;
    }
    router.push("/");
  }

  return (
    <div className="relative h-full">
      <header className="min-h-[3.5rem] bg-primary flex justify-center">
        <div className="flex z-20 px-4 lg:px-10 py-1 max-w-7xl sticky top-0 w-full justify-center items-center  text-white">
          <div className="flex flex-col md:flex-row w-full justify-between">
            <div className="flex flex-wrap md:flex-col p-2 gap-x-3 justify-between ">
              <h5 className="m-0">{projectName.replaceAll("_", " ")}</h5>
              {/* <span className="italic">Project management</span> */}
            </div>
          </div>
          <Button
            className=" flex whitespace-nowrap  m-0 gap-3 h-min hover:bg-transparent hover:text-white"
            variant="ghost"
            onClick={() => goBack()}
          >
            {subPage ? (
              <>
                <FaBackward size={20} /> Go back
              </>
            ) : (
              <>
                <FaWindowClose size={20} />
              </>
            )}
          </Button>
        </div>
      </header>
      <div>
        <SWRConfig value={{ provider: () => new Map() }}>
          {session.status === "loading" ? <Loading /> : children}
        </SWRConfig>
      </div>
    </div>
  );
}
