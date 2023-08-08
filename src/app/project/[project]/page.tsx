'use client';

import Loading from '@/components/loading';
import Error from '@/components/ui/error';
import { useProject } from '@/hooks/api';

export default function ProjectPage({ params }: { params: { project: number } }) {
  const { data: project, isLoading, error } = useProject(params.project);
  if (isLoading) return <Loading />;
  if (error) return <Error msg={error.message} />;
  if (!project) return null; //shouldn't happen, but typescript

  return (
    <main>
      <div>
        <h3>{project.name}</h3>
      </div>
    </main>
  );
}
