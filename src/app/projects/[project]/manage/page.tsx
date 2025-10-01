"use client";

import {
  useAllData,
  useCreateProject,
  useProject,
  useProjects,
  useUpdateProject,
} from "@/hooks/api";
import { Loading } from "@/components/ui/loading";
import { Error } from "@/components/ui/error";
import { useEffect, useMemo, useState, use } from "react";

import UploadData from "./UploadData";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import ProjectAdmins from "./ProjectAdmins";
import { Project } from "@/drizzle/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GetProject, GetReviewer } from "@/types";
import { MdSettings } from "react-icons/md";
import Step from "./Step";

type Tab = "submissions" | "references" | "volunteers";
const tabs: Tab[] = ["submissions", "volunteers", "references"];

export interface ProjectStatus {
  submissions: boolean;
  volunteers: boolean;
}

export default function ProjectPage(
  props: {
    params: Promise<{ project: number }>;
  }
) {
  const params = use(props.params);
  const {
    data: project,
    isLoading,
    error,
    mutate,
  } = useProject(params.project);
  const {
    data: reviewers,
    isLoading: reviewersLoading,
    error: reviewersError,
    mutate: mutateReviewers,
  } = useAllData<GetReviewer>({ projectId: params.project, what: "reviewers" });

  const biddingStatus = useMemo(() => {
    if (!reviewers) return { bidded: 0, invited: 0 };
    const bidded = reviewers.filter((r) => r.biddings.length > 0).length;
    const invited = reviewers.filter((r) => !!r.invitationSent).length;
    return { bidded, invited };
  }, [reviewers]);

  const router = useRouter();
  const [status, setStatus] = useState<ProjectStatus>({
    submissions: false,
    volunteers: false,
  });
  if (isLoading) return <Loading msg="Loading Project" />;
  if (error) return <Error msg={error.message} />;
  if (!project) return null; //shouldn't happen, but typescript

  return (
    <main className="flex justify-center">
      <div className="w-full grid grid-cols-1 md:grid-cols-2   max-w-7xl p-3 lg:p-9  gap-8">
        <div className="flex flex-col p-3">
          <h4>Project Settings</h4>
          <div className="border p-3 max-w-md rounded shadow-md bg-secondary">
            <div className="flex gap-3 justify-between">
              <div>
                <h3 className="mb-1">{project.name}</h3>
                <h5 className="mb-0">{project.division}</h5>
                <p>
                  Bidding closes on {"  "}
                  <span className="italic">
                    {project.deadline.toDateString()}
                  </span>
                </p>
              </div>
              <UpdateProjectForm project={project} />
            </div>
            <ProjectAdmins project={project} mutateProject={mutate} />
          </div>
        </div>
        <div className="w-full flex flex-col gap-9 h-full max-w-lg mx-auto lg:ml-auto">
          {/* Step 1-3 */}
          <UploadData projectId={params.project} setStatus={setStatus} />

          <Step
            disabled={!status?.submissions || !status?.volunteers}
            optional
            title="Step 4. Paper bidding"
            hint="Send invitations for paper bidding"
            doneMsg={`${biddingStatus.invited} reviewers invited, ${biddingStatus.bidded} bidded`}
            done={biddingStatus.bidded > 0 || biddingStatus.invited > 0}
            loading={reviewersLoading}
            onClick={() => {
              router.push(`/projects/${project.id}/manage/bidding`);
            }}
          />

          <Step
            disabled={!status?.submissions || !status?.volunteers}
            title="Step 5. Reviewer assignments"
            hint="Assign reviewers to submissions"
            doneMsg=""
            done={false}
            loading={reviewersLoading}
            onClick={() => {
              router.push(`/projects/${project.id}/manage/assignments`);
            }}
          />
        </div>
      </div>
    </main>
  );
}

interface updateProjectFormProps {
  project: GetProject;
}

function UpdateProjectForm({ project }: updateProjectFormProps) {
  const [open, setOpen] = useState(false);
  const { data: projects, isLoading } = useProjects();
  const { trigger: updateProject } = useUpdateProject(project.id);
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [division, setDivision] = useState(project.division);
  const [deadline, setDeadline] = useState(
    project.deadline.toISOString().split("T")[0],
  );

  useEffect(() => {
    setName(project.name);
    setDivision(project.division);
    setDeadline(project.deadline.toISOString().split("T")[0]);
  }, [project]);

  const changed =
    project.name !== name ||
    project.division !== division ||
    project.deadline.toISOString().split("T")[0] !== deadline;

  return (
    (<Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost">
          <MdSettings size={30} />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-sm"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Update project</DialogTitle>
          <DialogDescription></DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            updateProject({
              name,
              division,
              deadline: new Date(deadline),
            }).then(async (res) => {
              setOpen(false);
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
          <Button disabled={!division || !deadline || !name || !changed}>
            Update{" "}
          </Button>
        </form>
      </DialogContent>
    </Dialog>)
  );
}
