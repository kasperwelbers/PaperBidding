import useSWR, { Fetcher } from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSearchParams } from 'next/navigation';
import { Project } from '@/drizzle/schema';
import { useEffect, useMemo, useRef, useState } from 'react';

/** Wrapper for useSWR that:
 * - adds the token for authentication
 * - sets a type parameter for the return type
 */
export function useGET<ResponseType>(url: string) {
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

  return useSWR<ResponseType>([url, token], fetcher, { revalidateOnFocus: false });
}

/** Wrapper for useSWRMutation that:
 * - adds the token for authentication
 * - sets a type parameter for the return type
 * @param url
 * @returns
 */
export function usePOST<BodyType, ResponseType>(url: string) {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  function fetcher([url, token]: any, { arg }: { arg: BodyType }) {
    if (!token) throw new Error('No token provided');

    return fetch(url, {
      method: 'POST',
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
export function useProject(id: number) {
  return useGET<Project>('/api/project/' + id);
}
export function useData(projectId: number, what: 'submissions' | 'references' | 'volunteers') {
  return useGET<{ count: number }>(`/api/project/${projectId}/data/${what}`);
}

// POST HELPERS
export function useCreateProject() {
  return usePOST<{ name: string }, Project>('/api/project');
}

export function useUploadData(
  projectId: number,
  what: 'submissions' | 'references' | 'volunteers'
) {
  return usePOST<{ data: Record<string, any>[] }, Project>(
    `/api/project/${projectId}/data/${what}`
  );
}
