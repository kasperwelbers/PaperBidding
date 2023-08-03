import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { useSearchParams } from "next/navigation";

function fetcher([url, token]) {
  return fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => res.json());
}

function useToken() {
  const searchParams = useSearchParams();
  return searchParams.get("token");
}

function usePost<BodyType, BodyType>(url: string) {
  const token = useToken();

  function postRequest(url, { arg }: { arg: { arg: BodyType } }) {
    return fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(arg),
    });
  }

  return useSWRMutation(url, postRequest);
}

export function useProjects() {
  const token = useToken();
  return useSWR(["api/project", token], fetcher);
}

export function useProject() {
  const token = useToken();
  return useSWR(["api/project/myproject", token], fetcher);
}

export function useSubmission() {
  const token = useToken();
  return useSWR(["api/project/myproject/submissionID", token], fetcher);
}

export function useProjectUser() {
  const token = useToken();
  return useSWR(["api/user", token], fetcher);
}

export function useCreateProject() {
  return usePost<{ name: string }>("api/project");
}
