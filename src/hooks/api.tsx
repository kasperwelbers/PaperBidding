import useSWR, { Fetcher } from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSearchParams } from 'next/navigation';
import { Project } from '@/drizzle/schema';

/** Wrapper for useSWR that:
 * - adds the token for authentication
 * - sets a type parameter for the return type
 */
export function useGET<ResponseType>(url: string) {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  if (!token) throw new Error('No token provided');

  const fetcher = (url: string) => {
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

  return useSWR<ResponseType>(url, fetcher);
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

  function fetcher(url: string, { arg }: { arg: BodyType }) {
    return fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(arg)
    });
  }

  return useSWRMutation(url, fetcher);
}

// GET HELPERS
export function useProjects() {
  return useGET<Project[]>('/api/project');
}
export function useProject(id: number) {
  console.log(id);
  return useGET<Project>('/api/project/' + id);
}

// POST HELPERS
export function useCreateProject() {
  return usePOST<{ name: string }, Project>('api/project');
}
