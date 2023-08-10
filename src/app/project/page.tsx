'use client';

import { Error } from '@/components/ui/error';
import { Combobox } from '@/components/ui/combobox';
import { useProjects, useCreateProject } from '@/hooks/api';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Project } from '@/drizzle/schema';
import { Loading } from '@/components/ui/loading';

export default function ProjectsPage() {
  const { data: projects, isLoading, error } = useProjects();
  const { trigger: createProject } = useCreateProject();
  const [name, setName] = useState('');
  const router = useRouter();

  function onSelect(project: Project) {
    router.push(`/project/${project.id}?token=${project.token}`);
  }

  if (isLoading) return <Loading />;
  if (error) return <Error msg={error.message} />;
  if (!projects) return null; // shouldn't happen, but typescript

  return (
    <main className="flex min-h-screen p-12 gap-3 items-center justify-center">
      <div className="max-w-lg flex flex-col items-center p-3">
        <h3>Open project</h3>
        <Combobox items={projects} label={'project'} onSelect={onSelect} />
        <h3 className="mt-5">Create project</h3>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            createProject({ name }).then(async (res) => {
              const project = await res.json();
              onSelect(project);
            });
          }}
        >
          <Input
            placeholder="New project name"
            className="w-[200px]"
            value={name}
            minLength={3}
            onChange={(e) => {
              e.target.setCustomValidity('');
              if (projects.find((p: Project) => p.name === e.target.value)) {
                e.target.setCustomValidity('Project already exists');
              }
              console.log(projects);
              if (!/^[a-zA-Z0-9_-]+$/.test(e.target.value)) {
                e.target.setCustomValidity('Only letters, numbers, - and _ allowed');
              }
              setName(e.target.value);
            }}
            required
          ></Input>
          <Button>create</Button>
        </form>
      </div>
    </main>
  );
}
