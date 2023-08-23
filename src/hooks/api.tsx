import useSWR, { Fetcher } from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSearchParams } from 'next/navigation';
import { Project } from '@/drizzle/schema';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataPage, Reviewer } from '@/types';

/** Wrapper for useSWR that:
 * - adds the token for authentication
 * - sets a type parameter for the return type
 */
export function useGET<ResponseType>(url: string | null) {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const fetcher = ([url, token]: any) => {
    if (!token) throw new Error('No token provided');
    return fetch(url, {
      method: 'GET',
      headers: { Authorization: token }
    }).then((res) => {
      if (res.ok) {
        return res.json();
      } else {
        throw new Error(res.statusText);
      }
    });
  };

  return useSWR<ResponseType>(url ? [url, token] : null, fetcher, {
    revalidateOnFocus: false
  });
}

/** Wrapper for useSWR that paginates
 */
export function useGETPagionation<ResponseType>(url: string | null) {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const fetcher = async ([url, token]: any) => {
    if (!token) throw new Error('No token provided');
    const limit = 100;
    let offset = 0;

    const allData: ResponseType[] = [];
    while (true) {
      if (offset > 10000) throw new Error('Too many rows');
      const urlWithOffset = `${url}?offset=${offset}&limit=${limit}`;

      try {
        const res = await fetch(urlWithOffset, {
          method: 'GET',
          headers: { Authorization: token }
        });
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        allData.push(...data.rows);
        if (allData.length >= data.meta.count) break;
        offset += limit;
      } catch (e) {
        console.log(e);
        throw new Error('Failed to get data');
      }
    }
    return allData;
  };

  return useSWR<ResponseType[]>(url ? [url, token] : null, fetcher, {
    revalidateOnFocus: false
  });
}

/** Wrapper for useSWRMutation that:
 * - adds the token for authentication
 * - sets a type parameter for the return type
 * @param url
 * @returns
 */
export function usePOST<BodyType, ResponseType>(url: string, method: string = 'POST') {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  function fetcher([url, token]: any, { arg }: { arg: BodyType }) {
    if (!token) throw new Error('No token provided');

    return fetch(url, {
      method: method,
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(arg)
    });
  }

  return useSWRMutation([url, token], fetcher);
}

// GET HELPERS
export function useProjects() {
  return useGET<Project[]>('/api/project');
}
export function useProject(id: number, edit?: boolean) {
  const url = edit ? `/api/project/${id}?edit=true` : `/api/project/${id}`;
  return useGET<Project>(url);
}

interface DataResponse {
  rows: Record<string, any>[];
  meta: { count: number };
}
export function useData(
  projectId: number,
  what: 'submissions' | 'reviewers',
  params: Record<string, any> = {}
): DataPage {
  const limit = params.limit || 10;
  const [offset, setOffset] = useState(0);

  const urlParams = new URLSearchParams({
    ...params,
    offset: String(offset),
    limit: String(limit)
  });
  const urlParamsString = urlParams.toString();
  let url: string = `/api/project/${projectId}/data/${what}/?${urlParamsString}`;

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
    n: staleData.current?.meta.count,
    page,
    reset,
    setPage,
    nextPage,
    prevPage,
    isLoading,
    error: error?.message || ''
  };
}
export function useAllData<ResponseType>(projectId: number, what: 'submissions' | 'reviewers') {
  return useGETPagionation<ResponseType>(`/api/project/${projectId}/data/${what}`);
}

export function useAbstract(projectId: number, submissionId: number | undefined) {
  const url = submissionId ? `/api/project/${projectId}/data/submission/${submissionId}` : null;
  return useGET<{ abstract: string }>(url);
}

export function useReviewer(projectId: number, reviewerId: number) {
  return useGET<Reviewer>(`/api/project/${projectId}/data/reviewer/${reviewerId}`);
}

// POST HELPERS
export function useCreateProject() {
  return usePOST<{ name: string }, Project>('/api/project');
}

export function useUploadData(
  projectId: number,
  what: 'submissions' | 'reviewers',
  params?: Record<string, any>
) {
  let url: string = `/api/project/${projectId}/data/${what}`;
  if (params) {
    const urlParams = new URLSearchParams({ ...params });
    const urlParamsString = urlParams.toString();
    url += `?${urlParamsString}`;
  }

  return usePOST<{ data: Record<string, any>[] }, Project>(url);
}

export function useDeleteData(
  projectId: number,
  what: 'submissions' | 'reviewers',
  params?: Record<string, any>
) {
  let url: string = `/api/project/${projectId}/data/${what}`;
  if (params) {
    const urlParams = new URLSearchParams({ ...params });
    const urlParamsString = urlParams.toString();
    url += `?${urlParamsString}`;
  }

  return usePOST<any, Project>(url, 'DELETE');
}
