'use client';

import { useProject } from '@/hooks/api';
import { SWRConfig } from 'swr';

export default function ProjectLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { project: number; reviewer?: number };
}) {
  const { data: project, isLoading } = useProject(params.project);

  const projectName = project?.name || '';

  return (
    <div className="relative h-full">
      <header className="flex  z-20 px-1 sticky top-0 w-full justify-center bg-foreground  text-white">
        <div className="flex flex-col md:flex-row w-full justify-between">
          <div className="flex flex-wrap md:flex-col p-2 gap-x-3 justify-between ">
            <h5 className="m-0">{projectName.replaceAll('_', ' ')}</h5>
            <span className="italic">Project management</span>
          </div>
        </div>
      </header>
      <div>
        <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
      </div>
    </div>
  );
}
