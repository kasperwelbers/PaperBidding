import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { Project } from "@/drizzle/schema";
import { useRef, useState } from "react";
import {
  DataPage,
  Reviewer,
  GetProject,
  GetInvitation,
  ByReviewer,
  BySubmission,
  Admin,
  NoResponse,
  useAllDataParams,
  useGetPaginationParams,
} from "@/types";
import { useSession } from "next-auth/react";
import { z } from "zod";
import { GetAssignmentsSchema, GetProjectSchema } from "@/zodSchemas";

/** Wrapper for useSWR that:
 * - adds the token for authentication
 * - sets a type parameter for the return type
 */
export function useGET<ResponseType>(
  url: string | null,
  token?: string,
  schema?: z.ZodTypeAny,
) {
  const session = useSession();
  const auth = !!token || session.status === "authenticated";

  const fetcher = async ([url, token, auth]: any) => {
    if (!auth) throw new Error("Not authenticated");

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: token },
      });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      if (schema) return schema.parse(data);
      return data;
    } catch (e) {
      console.error(e);
      throw new Error("Failed to get data");
    }
  };
  return useSWR<ResponseType>(url ? [url, token, auth] : null, fetcher, {
    revalidateOnFocus: false,
  });
}

/** Wrapper for useSWR that paginates
 */
export function useGETPagionation<ResponseType>({
  url,
  token,
  meta,
  limit,
}: useGetPaginationParams) {
  const session = useSession();
  const auth = !!token || session.status === "authenticated";

  const fetcher = async ([url, token, auth]: any) => {
    if (!auth) throw new Error("Not authenticated");
    let offset = 0;

    const allData: ResponseType[] = [];
    while (true) {
      if (offset > 10000) throw new Error("Too many rows");
      let urlWithOffset = `${url}?offset=${offset}&limit=${limit}`;
      if (meta) urlWithOffset += "&meta=true";

      try {
        const res = await fetch(urlWithOffset, {
          method: "GET",
          headers: { Authorization: token },
        });
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        allData.push(...data.rows);

        if (allData.length >= data.meta.count) break;
        if (data.rows.length === 0) break;
        offset += limit;
      } catch (e) {
        console.log(e);
        throw new Error("Failed to get data");
      }
    }
    return allData;
  };

  return useSWR<ResponseType[]>(url ? [url, token, auth] : null, fetcher, {
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
  method: string = "POST",
  token?: string,
) {
  const session = useSession();
  const auth = !!token || session.status === "authenticated";

  function fetcher([url, token, auth]: any, { arg }: { arg: BodyType }) {
    if (!auth) throw new Error("Not authenticated");
    return fetch(url, {
      method: method,
      headers: { Authorization: `${token}` },
      body: JSON.stringify(arg),
    });
  }

  return useSWRMutation([url, token, auth], fetcher);
}

// GET HELPERS
export function useProjects() {
  return useGET<GetProject[]>("/api/projects");
}

export function useInvitations() {
  return useGET<GetInvitation[]>("/api/invitations");
}

export function useProject(id: number) {
  return useGET<GetProject>(`/api/projects/${id}`, undefined, GetProjectSchema);
}

interface DataResponse {
  rows: Record<string, any>[];
  meta: { count: number };
}
export function useData(
  projectId: number,
  what: "submissions" | "reviewers" | "volunteers",
  params: Record<string, any> = {},
): DataPage {
  const limit = params.limit || 6;
  const [offset, setOffset] = useState(0);

  const urlParams = new URLSearchParams({
    ...params,
    offset: String(offset),
    limit: String(limit),
  });
  const urlParamsString = urlParams.toString();
  let url: string = `/api/projects/${projectId}/data/${what}/?${urlParamsString}`;

  const { data, mutate, isLoading, error } = useGET<DataResponse>(url);
  const staleData = useRef<DataResponse>();
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
    n: Number(staleData.current?.meta.count),
    page,
    reset,
    setPage,
    nextPage,
    prevPage,
    isLoading,
    error: error?.message || "",
  };
}

export function useAllData<ResponseType>({
  projectId,
  what,
  token,
  meta,
  limit,
}: useAllDataParams) {
  let url = `/api/projects/${projectId}/data/${what}`;
  return useGETPagionation<ResponseType>({
    url,
    token,
    meta,
    limit: limit || 1000,
  });
}

export function useAbstract(
  projectId: number,
  submissionId: number | undefined,
  token: string,
) {
  const url = submissionId
    ? `/api/projects/${projectId}/data/submission/${submissionId}`
    : null;
  return useGET<{ abstract: string }>(url, token);
}

export function useReviewer(
  projectId: number,
  reviewerId: number,
  token: string,
) {
  return useGET<Reviewer>(
    `/api/projects/${projectId}/data/reviewers/${reviewerId}`,
    token,
  );
}

export function useAdmins() {
  return useGET<Admin[]>("/api/admins");
}

export function useAssignments(projectId: number) {
  return useGET<z.infer<typeof GetAssignmentsSchema>>(
    `/api/projects/${projectId}/assignments`,
    undefined,
    GetAssignmentsSchema,
  );
}

// POST HELPERS
export function useCreateProject() {
  return usePOST<{ name: string; division: string; deadline: Date }, Project>(
    "/api/projects",
  );
}
export function useUpdateProject(projectId: number) {
  return usePOST<{ name: string; division: string; deadline: Date }, Project>(
    `/api/projects/${projectId}`,
  );
}

export function useAddAdmins() {
  return usePOST<Admin[], NoResponse>("/api/admins");
}

export function usePostBiddings(
  projectId: number,
  reviewerId: number,
  token: string,
) {
  return usePOST<{}, { selected: number[] }>(
    `/api/projects/${projectId}/data/reviewers/${reviewerId}/bid`,
    "POST",
    token,
  );
}

export function useUploadData(
  projectId: number,
  what: "submissions" | "reviewers" | "volunteers",
  params?: Record<string, any>,
) {
  let url: string = `/api/projects/${projectId}/data/${what}`;
  if (params) {
    const urlParams = new URLSearchParams({ ...params });
    const urlParamsString = urlParams.toString();
    url += `?${urlParamsString}`;
  }

  return usePOST<{ data: Record<string, any>[] }, Project>(url);
}

export function useDeleteData(
  projectId: number,
  what: "submissions" | "reviewers" | "volunteers",
  params?: Record<string, any>,
) {
  let url: string = `/api/projects/${projectId}/data/${what}`;
  if (params) {
    const urlParams = new URLSearchParams({ ...params });
    const urlParamsString = urlParams.toString();
    url += `?${urlParamsString}`;
  }

  return usePOST<any, Project>(url, "DELETE");
}

export function useUploadAssignments(projectId: number) {
  return usePOST<
    { byReviewer: ByReviewer[]; bySubmission: BySubmission[] },
    Project
  >(`/api/projects/${projectId}/assignments`);
}
