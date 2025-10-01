import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Project } from "@/drizzle/schema";
import { GetProject } from "@/types";
import { Plus, Trash, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FaPlus } from "react-icons/fa";

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
    const res = await fetch(`/api/projects/${project.id}/admin`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      project.admins.push(email);
      mutateProject({ ...project });
    }
  }
  async function rmAdmin(email: string) {
    const res = await fetch(`/api/projects/${project.id}/admin`, {
      method: "DELETE",
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      project.admins = project.admins.filter((admin) => admin != email);
      mutateProject({ ...project });
    }
  }

  return (
    <div className="mt-3">
      <div className="text-left flex-auto">
        <div className="flex items-center  gap-1">
          <h6 className="m-0">Admins</h6>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="h-8 w-8" size="icon">
                <FaPlus size={16} />
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <CreateAdminForm admins={admins} addAdmin={addAdmin} />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="overflow-auto">
        {admins.map((admin) => {
          return (
            <li className="flex gap-3 items-center" key={admin}>
              {admin}{" "}
              <Button
                size="icon"
                className={`${admin == project.creator ? "hidden" : ""} w-6 h-6`}
                variant="ghost"
              >
                <Popover>
                  <PopoverTrigger>
                    <X size={16} />
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="flex flex-col gap-3">
                      <p>
                        {" "}
                        Are you sure you want to remove{" "}
                        <span className="font-bold text-primary">
                          {admin}
                        </span>{" "}
                        as an admin?
                      </p>
                      <Button onClick={(e) => rmAdmin(admin)}>Yes</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </Button>
            </li>
          );
        })}
      </div>
    </div>
  );
}

interface createAdminFormProps {
  admins: string[];
  addAdmin: (email: string) => void;
}

function CreateAdminForm({ admins, addAdmin }: createAdminFormProps) {
  const [name, setName] = useState("");

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addAdmin(name);
          setName("");
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
            e.target.setCustomValidity("");
            if (admins.includes(e.target.value)) {
              e.target.setCustomValidity("Admin already exists");
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
