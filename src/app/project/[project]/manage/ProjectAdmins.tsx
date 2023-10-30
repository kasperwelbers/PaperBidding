'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Project } from '@/drizzle/schema';
import { GetProject } from '@/types';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Props {
  project: GetProject;
  mutateProject: (project: GetProject) => void;
}

export default function ProjectAdmins({ project, mutateProject }: Props) {
  const [admins, setAdmins] = useState<string[]>(project.admins);

  useEffect(() => {
    setAdmins(project.admins);
  }, [project]);

  async function addAdmin(email: string) {
    const res = await fetch(`/api/project/${project.id}/admin`, {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    if (res.ok) {
      project.admins.push(email);
      mutateProject({ ...project });
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3 w-full">
      <div className="text-left flex-auto">
        <h3>Project admins</h3>
        <ul className="text-sm overflow-auto">
          {admins.map((admin) => {
            return <li key={admin}>{admin}</li>;
          })}
        </ul>
      </div>
      <CreateAdminForm admins={admins} addAdmin={addAdmin} />
    </div>
  );
}

interface createAdminFormProps {
  admins: string[];
  addAdmin: (email: string) => void;
}

function CreateAdminForm({ admins, addAdmin }: createAdminFormProps) {
  const [name, setName] = useState('');

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addAdmin(name);
          setName('');
        }}
      >
        <Input
          placeholder="Add admin email"
          className="w-full"
          type="email"
          name="email"
          value={name}
          minLength={3}
          onChange={(e) => {
            e.target.setCustomValidity('');
            if (admins.includes(e.target.value)) {
              e.target.setCustomValidity('Admin already exists');
            }

            setName(e.target.value);
          }}
          required
        ></Input>
        <Button>add</Button>
      </form>
    </div>
  );
}
