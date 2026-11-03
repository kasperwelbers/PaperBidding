import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, unwrap } from "../api";
import { Button, Card, ErrorText, Input } from "../ui";

/** Superadmin only: who can create conferences */
export default function Admins() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const admins = useQuery({ queryKey: ["admins"], queryFn: () => unwrap(api.admins.$get()) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admins"] });

  const add = useMutation({
    mutationFn: () => unwrap(api.admins.$post({ json: { email } })),
    onSuccess: () => {
      setEmail("");
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (email: string) => unwrap(api.admins[":email"].$delete({ param: { email } })),
    onSuccess: refresh,
  });

  return (
    <Card title="Admins (can create conferences)">
      <ErrorText error={admins.error || add.error || remove.error} />
      <ul className="mb-4 flex flex-col gap-1">
        {admins.data?.map((a) => (
          <li key={a.email} className="flex items-center justify-between text-sm">
            {a.email}
            <Button variant="danger" onClick={() => remove.mutate(a.email)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <Input type="email" required placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button disabled={add.isPending}>Add admin</Button>
      </form>
    </Card>
  );
}
