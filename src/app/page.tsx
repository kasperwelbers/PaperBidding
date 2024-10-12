"use client";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import { Project } from "@/drizzle/schema";
import { useCreateProject, useInvitations, useProjects } from "@/hooks/api";
import { Session } from "next-auth";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GetProject } from "@/types";
import Link from "next/link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { User } from "lucide-react";
import { MdAccountCircle } from "react-icons/md";
import { FaSignOutAlt } from "react-icons/fa";

export default function Home() {
  const session = useSession();
  const { data: projects, isLoading } = useProjects();
  const { data: invitations, isLoading: isLoadingInvitations } =
    useInvitations();
  const canCreate = session?.data?.user?.canCreateProject || false;
  console.log(session.data);

  return (
    <main className="flex min-h-screen flex-col items-center">
      <div className="w-full bg-secondary p-8 border-b-2 border-primary">
        <SignOutButton />
        <h1 className="text-3xl md:text-5xl font-bold mb-2 text-center">
          Paper Bidding
        </h1>
        <h4 className="text-xl md:text-2xl text-center mt-4 mb-0">
          Paper bidding website of the ICA Computational Methods Division
        </h4>
      </div>
      <div
        className={`mt-10 p-3 grid gap-6 ${canCreate ? "grid-cols-1 lg:grid-cols-2" : ""}`}
      >
        <div className="flex flex-col lg:flex-row gap-12 ">
          {session.status === "loading" ? <Loading msg="Loading..." /> : null}
          {session.status === "unauthenticated" ? <SignInForm /> : null}
          {session.status === "authenticated" ? (
            <AdminPanel
              canCreate={canCreate}
              projects={projects}
              loadingProjects={isLoading}
            />
          ) : null}
        </div>
        <div>
          {isLoadingInvitations ? (
            <Loading msg="Loading invitations..." />
          ) : null}
          {session.status === "authenticated" && invitations ? (
            <div className="flex flex-col">
              <h3 className="text-center">Bidding invitations</h3>
              {invitations?.length ? null : (
                <span className="text-center italic">{`you dont have any current invitations :(`}</span>
              )}
              <div className=" max-w-lg">
                {invitations.map((invitation) => {
                  return (
                    <Button key={invitation.link} className="w-full">
                      <Link href={invitation.link}>{invitation.label}</Link>
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function SignOutButton() {
  const session = useSession();
  if (session.status !== "authenticated") return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="absolute right-1 top-1 py-0 ml-3 mb-4 bg-secondary text-primary hover:text-secondary">
          <MdAccountCircle size={32} />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="text-center">
          {session.data.user.email}
          <Button
            className="flex gap-3 items-center justify-center mx-auto"
            variant="ghost"
            onClick={() => signOut()}
          >
            Sign-out
            <FaSignOutAlt size={16} />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface AdminPanelProps {
  canCreate: boolean;
  projects: GetProject[] | undefined;
  loadingProjects: boolean;
}

function AdminPanel({ canCreate, projects, loadingProjects }: AdminPanelProps) {
  return (
    <div className="flex flex-col gap-12 p-6  rounded border-2 border-primary">
      <h3 className="text-center">Project management</h3>
      <div className="flex flex-col lg:flex-row gap-12">
        {projects?.length ? (
          <SelectProject
            projects={projects}
            loadingProjects={loadingProjects}
          />
        ) : null}
        {canCreate ? <CreateProjectForm projects={projects} /> : null}
      </div>
    </div>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSigningIn(true);
    signIn("email", { email });
  }

  if (signingIn) return <Loading msg={`Sending sign-in email to ${email}`} />;

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
  const [name, setName] = useState("");

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
              setName("");
            });
        }}
      >
        <Input
          placeholder="Project name"
          className="w-full"
          value={name}
          minLength={3}
          onChange={(e) => {
            e.target.setCustomValidity("");
            if (projects?.find((p: GetProject) => p.name === e.target.value)) {
              e.target.setCustomValidity("Project already exists");
            }
            if (!/^[a-zA-Z0-9_ -]+$/.test(e.target.value)) {
              e.target.setCustomValidity(
                "Only letters, numbers, dashes, underscores and spaces are allowed",
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
  projects?: GetProject[];
  loadingProjects: boolean;
}

function SelectProject({ projects, loadingProjects }: SelectProjectProps) {
  const router = useRouter();

  function onSelect(project: GetProject) {
    router.push(`/project/${project.id}/manage`);
  }

  return (
    <div className="w-full flex flex-col items-center">
      <h4>Select project </h4>
      {loadingProjects ? (
        <p className="text-center animate-bounce mt-10">loading projects...</p>
      ) : (
        <>
          <Combobox
            items={projects || []}
            label={"project"}
            onSelect={onSelect}
          />
        </>
      )}
    </div>
  );
}
