import useSWR, { Fetcher } from "swr";
import useSWRMutation from "swr/mutation";
import { useSearchParams } from "next/navigation";
import { Project } from "@/drizzle/schema";
import { useCallback, useMemo, useRef, useState } from "react";
import { DataPage } from "@/types";

/** Wrapper for useSWR that:
 * - adds the token for authentication
 * - sets a type parameter for the return type
 */
export function useGET<ResponseType>(url: string) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const fetcher = ([url, token]: any) => {
    if (!token) throw new Error("No token provided");
    return fetch(url, {
      method: "GET",
      headers: { Authorization: token },
    }).then((res) => {
      if (res.ok) {
        return res.json();
      } else {
        throw new Error(res.statusText);
      }
    });
  };

  return useSWR<ResponseType>([url, token], fetcher, {
    revalidateOnFocus: false,
  });
}

/** Wrapper for useSWRMutation that:
 * - adds the token for authentication
 * - sets a type parameter for the return type
 * @param url
 * @returns
 */
export function usePOST<BodyType, ResponseType>(
  url: string,
  method: string = "POST"
) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  function fetcher([url, token]: any, { arg }: { arg: BodyType }) {
    if (!token) throw new Error("No token provided");

    return fetch(url, {
      method: method,
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(arg),
    });
  }

  return useSWRMutation([url, token], fetcher);
}

// GET HELPERS
export function useProjects() {
  return useGET<Project[]>("/api/project");
}
export function useProject(id: number) {
  return useGET<Project>("/api/project/" + id);
}
export function useData(
  projectId: number,
  what: "submissions" | "references" | "volunteers"
): DataPage {
  const limit = 10;
  const [offset, setOffset] = useState(0);

  let url: string = "";
  if (what === "submissions")
    url = `/api/project/${projectId}/data/submissions?offset=${offset}&limit=${limit}`;
  if (what === "references")
    url = `/api/project/${projectId}/data/submissions?reference=true&offset=${offset}&limit=${limit}`;
  if (what === "volunteers")
    url = `/api/project/${projectId}/data/volunteers?offset=${offset}&limit=${limit}`;

  const { data, mutate, isLoading } = useGET<Record<string, any>[]>(url);
  const staleData = useRef<Record<string, any>[]>();
  if (!isLoading) staleData.current = data;

  const reset = () => {
    setOffset(0);
    mutate();
  };
  const page = Math.floor(offset / limit) + 1;
  const pages = data ? Math.ceil(data.meta.count / limit) : undefined;
  const setPage = (page: number) => {
    setOffset((page - 1) * limit);
  };
  let nextPage: undefined | (() => void);
  let prevPage: undefined | (() => void);
  if (pages && page < pages) nextPage = () => setPage(page + 1);
  if (page > 1) prevPage = () => setPage(page - 1);

  return {
    data: staleData.current?.rows,
    n: staleData.current?.meta.count,
    page,
    reset,
    setPage,
    nextPage,
    prevPage,
    isLoading,
  };
}

// POST HELPERS
export function useCreateProject() {
  return usePOST<{ name: string }, Project>("/api/project");
}

export function useUploadData(
  projectId: number,
  what: "submissions" | "references" | "volunteers"
) {
  let url: string = "";
  if (what === "submissions")
    url = `/api/project/${projectId}/data/submissions`;
  if (what === "references")
    url = `/api/project/${projectId}/data/submissions?reference=true`;
  if (what === "volunteers") url = `/api/project/${projectId}/data/volunteers`;

  return usePOST<{ data: Record<string, any>[] }, Project>(url);
}

export function useDeleteData(
  projectId: number,
  what: "submissions" | "references" | "volunteers"
) {
  let url: string = "";
  if (what === "submissions")
    url = `/api/project/${projectId}/data/submissions`;
  if (what === "references")
    url = `/api/project/${projectId}/data/submissions?reference=true`;
  if (what === "volunteers") url = `/api/project/${projectId}/data/volunteers`;
  return usePOST<any, Project>(url, "DELETE");
}
