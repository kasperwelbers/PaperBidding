'use client';

import { Error } from '@/components/ui/error';
import { Combobox } from '@/components/ui/combobox';
import { useProjects, useCreateProject } from '@/hooks/api';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Loading } from '@/components/ui/loading';
import { Project } from '@/drizzle/schema';

export default function ProjectsPage() {
  const { data: projects, isLoading, error } = useProjects();
  const [project, setProject] = useState<Project>();
  const router = useRouter();

  function onSelect(project: Project) {
    router.push(`/project/${project.id}/manage?token=${project.editToken}`);
  }

  if (isLoading) return <Loading />;
  if (error) return <Error msg={error.message} />;
  if (!projects) return null; // shouldn't happen, but typescript

  return (
    <main className="flex p-12 gap-3 justify-center">
      <div className="flex flex-col md:flex-row gap-10 items-center md:items-start">
        <div className="w-1/2 flex flex-col gap-8">
          <div>
            <h1 className="text-center">Admin page</h1>
            <p>On this page you can create new projects and access any project as a manager</p>
          </div>
        </div>
        <div className="w-1/2 max-w-[18rem] flex flex-col items-center p-5 border-2 rounded border-primary gap-10">
          <div className="w-full">
            <h3 className="text-center">Select project</h3>
            <Combobox
              items={projects}
              label={'project'}
              onSelect={onSelect}
              controlledValue={project?.name}
            />
          </div>
          <CreateProjectForm onSelect={onSelect} projects={projects} />
        </div>
      </div>
    </main>
  );
}

interface createProjectFormProps {
  onSelect: (project: Project) => void;
  projects: Project[];
}

function CreateProjectForm({ onSelect, projects }: createProjectFormProps) {
  const { trigger: createProject } = useCreateProject();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  if (creating) return <Loading msg={`Creating new project`} />;

  return (
    <div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setCreating(true);
          createProject({ name: name.replaceAll(' ', '_') })
            .then(async (res) => {
              const project = await res.json();
              onSelect(project);
            })
            .finally(() => {
              setCreating(false);
              setName('');
            });
        }}
      >
        <Input
          placeholder="New project name"
          className="w-full"
          value={name}
          minLength={3}
          onChange={(e) => {
            e.target.setCustomValidity('');
            if (projects.find((p: Project) => p.name === e.target.value)) {
              e.target.setCustomValidity('Project already exists');
            }
            if (!/^[a-zA-Z0-9_ -]+$/.test(e.target.value)) {
              e.target.setCustomValidity(
                'Only letters, numbers, dashes, underscores and spaces are allowed'
              );
            }
            setName(e.target.value);
          }}
          required
        ></Input>
        <Button>create</Button>
      </form>
    </div>
  );
}
