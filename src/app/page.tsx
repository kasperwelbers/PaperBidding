'use client';

import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { Project } from '@/drizzle/schema';
import { useCreateProject, useProjects } from '@/hooks/api';
import { Session } from 'next-auth';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GetProject } from '@/types';

export default function Home() {
  const session = useSession();
  const { data: projects, isLoading } = useProjects();

  return (
    <main className="flex min-h-screen flex-col items-center">
      <div className="w-full bg-secondary p-8 border-b-2 border-primary">
        <h1 className="text-5xl font-bold mb-2 text-center">Paper Bidding</h1>
        <h4 className="text-center mt-4 mb-0">
          Paper bidding website of the ICA Computational Methods Division
        </h4>
      </div>
      {session?.data?.user?.email ? (
        <div className="mt-8 p-4 flex  items-center justify-center">
          <h5 className="">Welcome {session.data.user.email}!</h5>
          <Button
            className="py-0 ml-3 mb-3 bg-secondary text-primary hover:text-secondary"
            onClick={() => signOut()}
          >
            Sign-out
          </Button>
        </div>
      ) : null}
      <div className="flex flex-col lg:flex-row gap-12 mt-6 px-4">
        {session.status === 'loading' ? <Loading msg="Loading..." /> : null}
        {session.status === 'authenticated' ? (
          <SelectProject session={session.data} projects={projects} loadingProjects={isLoading} />
        ) : null}
        {session.status === 'unauthenticated' ? <SignInForm /> : null}
        {session?.data?.user?.canCreateProject ? <CreateProjectForm projects={projects} /> : null}
      </div>
    </main>
  );
}

function SignInForm() {
  const [email, setEmail] = useState('');

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    signIn('email', { email });
  }

  return (
    <form className="flex flex-col justify-center" onSubmit={onSubmit}>
      <p>Welcome! Please sign-in to get started</p>
      <input
        className="border-2 border-primary px-3 py-1 rounded mt-2"
        type="email"
        name="email"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button className="border-2 border-primary bg-secondary px-3 py-1 rounded mt-2">
        Send sign-in email
      </button>
    </form>
  );
}

interface createProjectFormProps {
  projects?: GetProject[];
}

function CreateProjectForm({ projects }: createProjectFormProps) {
  const { trigger: createProject } = useCreateProject();
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const [name, setName] = useState('');

  function onSelect(project: Project) {
    router.push(`/project/${project.id}/manage`);
  }

  if (creating) return <Loading msg={`Creating new project`} />;

  return (
    <div className="w-full">
      <h4 className="text-center">Create new project</h4>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setCreating(true);
          createProject({ name: name })
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
          placeholder="Project name"
          className="w-full"
          value={name}
          minLength={3}
          onChange={(e) => {
            e.target.setCustomValidity('');
            if (projects?.find((p: GetProject) => p.name === e.target.value)) {
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

interface SelectProjectProps {
  session: Session;
  projects?: GetProject[];
  loadingProjects: boolean;
}

function SelectProject({ session, projects, loadingProjects }: SelectProjectProps) {
  const router = useRouter();

  function onSelect(project: GetProject) {
    router.push(`/project/${project.id}/manage`);
  }

  return (
    <div className="w-full">
      <h4>Select project </h4>
      {loadingProjects ? (
        <p className="text-center animate-bounce mt-10">loading projects...</p>
      ) : (
        <>
          <Combobox items={projects || []} label={'project'} onSelect={onSelect} />
        </>
      )}
    </div>
  );
}
