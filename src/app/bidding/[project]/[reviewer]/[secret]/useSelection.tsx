'use client';

import { usePostBiddings } from '@/hooks/api';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function useSelection(projectId: number, reviewerId: number, token: string) {
  const [selected, setSelectedState] = useState<number[]>([]);
  const [selectionStatus, setSelectionStatus] = useState('loading');
  const { trigger: postSelection } = usePostBiddings(projectId, reviewerId, token);

  useEffect(() => {
    const url = `/api/project/${projectId}/data/reviewer/${reviewerId}/bid`;
    fetch(url, {
      method: 'GET',
      headers: { Authorization: token }
    })
      .then((res) => res.json())
      .then(({ selection }) => {
        setSelectedState(selection);
        setSelectionStatus('ready');
      })
      .catch((e) => {
        console.error(e);
        setSelectionStatus('error');
      });
  }, [projectId, reviewerId, token]);

  const setSelected = useCallback(
    (selected: number[]) => {
      setSelectedState((prev) => {
        postSelection({ selected: [...selected] })
          .then((res) => {
            if (!res.ok) setSelectedState(prev);
          })
          .catch((e) => {
            console.error(e);
            setSelectedState(prev);
          });
        return selected;
      });
    },
    [postSelection, setSelectedState]
  );

  return { selected, setSelected, selectionStatus };
}
