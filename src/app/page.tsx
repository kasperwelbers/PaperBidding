'use client';

import { Combobox } from '@/components/ui/combobox';
import { useProjects } from '@/hooks/api';
import { Session } from 'next-auth';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useState } from 'react';

export default function Home() {
  const session = useSession();

  return (
    <main className="flex min-h-screen flex-col items-center">
      <div className="w-full bg-secondary p-8">
        <h1 className="text-5xl font-bold mb-2 text-center">Paper Bidding</h1>
        <h4 className="text-center mt-4 mb-0">
          Paper bidding website of the ICA Computational Methods Division
        </h4>
      </div>
      <div className="mt-12">
        {session.status === 'authenticated' ? <SelectProject session={session.data} /> : null}
        {session.status === 'unauthenticated' ? <SignInForm /> : null}
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

function SelectProject({ session }: { session: Session }) {
  const { data: projects, isLoading, error } = useProjects();
  const [project, setProject] = useState<Project>();

  function onSelect(project: Project) {
    router.push(`/project/${project.id}/manage?token=${project.editToken}`);
  }

  return (
    <div>
      <h4>
        Welcome <span className="text-primary">{session.user?.name || session.user?.email}</span>!
      </h4>
      {isLoading ? (
        <p className="text-center animate-bounce mt-10">loading projects...</p>
      ) : (
        <>
          {project !== undefined ? <p className="text-center">Please select a project</p> : ''}
          <Combobox
            items={projects || []}
            label={'project'}
            onSelect={onSelect}
            controlledValue={project?.name}
          />
        </>
      )}
    </div>
  );
}
