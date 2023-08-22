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

  return (
    <div className="relative h-full">
      <header className=" flex items-center justify-center bg-foreground h-12 text-white">
        <h3 className="m-0">Project: {project?.name}</h3>
      </header>
      <div>
        <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
      </div>
    </div>
  );
}
