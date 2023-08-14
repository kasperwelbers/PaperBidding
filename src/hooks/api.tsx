import useSWR, { Fetcher } from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSearchParams } from 'next/navigation';
import { Project } from '@/drizzle/schema';
import { useCallback, useMemo, useRef, useState } from 'react';
import { DataPage } from '@/types';

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
export function useProject(id: number) {
  return useGET<Project>('/api/project/' + id);
}
export function useData(
  projectId: number,
  what: 'submissions' | 'references' | 'volunteers'
): DataPage {
  const limit = 10;
  const [offset, setOffset] = useState(0);
  const { data, mutate, isLoading } = useGET<Record<string, any>[]>(
    `/api/project/${projectId}/data/${what}?offset=${offset}&limit=${limit + 1}`
  );

  const reset = () => {
    setOffset(0);
    mutate();
  };
  let nextPage: undefined | (() => void);
  let prevPage: undefined | (() => void);
  if (data) {
    if (data.length > limit) {
      nextPage = () => setOffset(offset + limit);
    }
    if (offset.current > 0) {
      prevPage = () => setOffset(Math.max(0, offset - limit));
    }
  }

  const realData = useMemo(() => {
    // we added one extra to see if there is a next page. remove it
    return data?.slice(0, limit);
  }, [data]);

  return { data: realData, reset, nextPage, prevPage, isLoading };
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

export function useDeleteData(
  projectId: number,
  what: 'submissions' | 'references' | 'volunteers'
) {
  return usePOST<any, Project>(`/api/project/${projectId}/data/${what}`, 'DELETE');
}
