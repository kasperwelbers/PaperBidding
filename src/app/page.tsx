"use client";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import { Project } from "@/drizzle/schema";
import {
  useAddAdmins,
  useAdmins,
  useCreateProject,
  useInvitations,
  useProjects,
} from "@/hooks/api";
import { Session } from "next-auth";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GetProject } from "@/types";
import Markdown from "react-markdown";
import Link from "next/link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Eye, EyeOff, User } from "lucide-react";
import { MdAccountCircle, MdManageAccounts } from "react-icons/md";
import { FaSignOutAlt, FaTrash } from "react-icons/fa";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const infoDefault = `
## Welcome!

This is the paper bidding system for the ICA Computational Methods Division.
`;

const infoLogin = `
Please sign in to get started.
`;

const infoNoAdmin = `
You are not registered as a division planner, so you will only see projects
to which you have been invited, and cannot create new projects.
If you do not see your project, please ask the division planner to invite you.

If you are a division planner and want to create a new project,
please ask Kasper to give you access.
`;

const infoAdmin = `
Select a project to manage it, or create a new project.
`;

export default function Home() {
  const session = useSession();
  const { data: projects, isLoading } = useProjects();
  const canCreate = !!session?.data?.user?.canCreateProject;

  function info() {
    if (session.status !== "authenticated") return infoLogin;
    if (!canCreate) return infoNoAdmin;
    return infoAdmin;
  }

  return (
    <main className="flex min-h-screen flex-col items-center">
      <header className="min-h-[3.5rem] w-full bg-primary flex justify-center">
        <div className="flex z-20 px-4 lg:px-10 py-1 max-w-7xl sticky top-0 w-full justify-center items-center  text-white">
          <div className="flex flex-col md:flex-row w-full justify-between">
            <div className="flex flex-wrap md:flex-col py-2 gap-x-3 justify-between ">
              <h5 className="m-0">ICA Paper bidding</h5>
            </div>
          </div>
          <div className="flex gap-2">
            {session?.data?.user?.isSuperAdmin ? <AdminList /> : null}
            <SignOutButton />
          </div>
        </div>
      </header>
      <div
        className={`mt-12 px-4 lg:px-10 grid gap-6 grid-cols-1 lg:grid-cols-[1fr,max-content] w-full justify-between max-w-7xl`}
      >
        <div className="max-w-2xl">
          <Markdown>{infoDefault + info()}</Markdown>
        </div>
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
        <Button className="p-0 m-0 w-min h-min hover:bg-transparent hover:text-white">
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
    <div className="flex flex-col gap-12">
      <div className="flex  flex-col gap-12">
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

  if (signingIn) return <Loading msg="Sending..." />;

  return (
    <form className="flex flex-col gap-1 justify-center" onSubmit={onSubmit}>
      <Input
        className="border-2 border-primary px-3 py-1 rounded mt-2"
        type="email"
        name="email"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button disabled={!email}>Send sign-in email</Button>
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
  const [division, setDivision] = useState("");
  const [deadline, setDeadline] = useState(() => {
    const year = new Date().getFullYear();
    return `${year}-11-10`;
  });

  function onSelect(project: Project) {
    router.push(`/projects/${project.id}/manage`);
  }

  if (creating) return <Loading msg={`Creating new project`} />;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Create new project</Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-sm"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Create new project</DialogTitle>
          <DialogDescription>
            Specify the name of the project, the ICA division, and the deadline
            for the paper bidding. (You can change all of these later)
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            setCreating(true);
            createProject({ name, division, deadline: new Date(deadline) })
              .then(async (res) => {
                const project = await res.json();
                onSelect(project);
              })
              .finally(() => {
                setName("");
              });
          }}
        >
          <div className="grid grid-cols-[6rem,1fr] gap-3 items-center">
            <label htmlFor="name">Name</label>
            <Input
              name="name"
              placeholder="Project name"
              className="w-full"
              value={name}
              minLength={3}
              onChange={(e) => {
                e.target.setCustomValidity("");
                if (
                  projects?.find((p: GetProject) => p.name === e.target.value)
                ) {
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
            <label htmlFor="division">Division</label>
            <Input
              name="division"
              placeholder="Division name"
              className="w-full"
              value={division}
              minLength={3}
              onChange={(e) => {
                setDivision(e.target.value);
              }}
              required
            ></Input>
            <label htmlFor="deadline">Deadline</label>
            <Input
              name="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
            ></Input>
          </div>
          <Button disabled={!division || !deadline || !name}>
            Create project
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface SelectProjectProps {
  projects?: GetProject[];
  loadingProjects: boolean;
}

function SelectProject({ projects, loadingProjects }: SelectProjectProps) {
  const router = useRouter();
  const [showTrash, setShowTrash] = useState(false);

  function onSelect(project: GetProject) {
    router.push(`/projects/${project.id}/manage`);
  }

  return (
    <div className="w-full flex flex-col ">
      <div className="flex justify-between items-center">
        <h4 className="m-0">Projects</h4>
        <Button
          variant="ghost"
          className="flex gap-2 h-8 text-foreground/50"
          onClick={() => setShowTrash(!showTrash)}
        >
          archived {showTrash ? <Eye /> : <EyeOff />}
        </Button>
      </div>
      {loadingProjects ? (
        <p className="text-center animate-bounce mt-10">loading projects...</p>
      ) : (
        <div className="mt-3 flex flex-col gap-1">
          {projects?.map((project) => {
            if (!showTrash && project.archived) return null;
            return (
              <div
                key={project.id}
                className="flex justify-between items-center gap-2"
              >
                <Button
                  variant="secondary"
                  className=" w-full h-8  font-bold justify-start"
                  onClick={() => onSelect(project)}
                >
                  {project.name}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminList() {
  const { data } = useAdmins();
  const { trigger: addAdmin } = useAddAdmins();
  const [email, setEmail] = useState("");

  if (!data)
    return (
      <Button className="p-0 m-0 w-min h-min hover:bg-transparent hover:text-white">
        <MdManageAccounts size={32} />
      </Button>
    );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    addAdmin([{ email }]);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="p-0 m-0 w-min h-min hover:bg-transparent hover:text-white">
          <MdManageAccounts size={32} />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="w-96 max-w-[90vw]`"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Admins</DialogTitle>
          <DialogDescription>Admins can create new projects</DialogDescription>
        </DialogHeader>
        <div>
          <ul className="list-disc list-inside">
            {data.map((admin) => {
              return <li key={admin.email}>{admin.email}</li>;
            })}
          </ul>
        </div>
        <div>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Input
              name="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button>Add admin</Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
