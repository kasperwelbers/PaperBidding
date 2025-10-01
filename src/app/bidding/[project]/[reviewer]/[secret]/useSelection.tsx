import { usePostBiddings } from "@/hooks/api";
import { useCallback, useEffect, useRef, useState } from "react";

export default function useSelection(
  projectId: number,
  reviewerId: number,
  token: string,
) {
  const [selected, setSelectedState] = useState<number[]>([]);
  const [selectionStatus, setSelectionStatus] = useState("loading");
  const { trigger: postSelection } = usePostBiddings(
    projectId,
    reviewerId,
    token,
  );
  const currentSelectionRef = useRef<number[]>(selected);
  currentSelectionRef.current = selected;

  useEffect(() => {
    const url = `/api/projects/${projectId}/data/reviewers/${reviewerId}/bid`;
    fetch(url, {
      method: "GET",
      headers: { Authorization: token },
    })
      .then((res) => res.json())
      .then(({ selection }) => {
        setSelectedState(selection || []);
        setSelectionStatus("ready");
      })
      .catch((e) => {
        console.error(e);
        setSelectionStatus("error");
      });
  }, [projectId, reviewerId, token]);

  const setSelected = useCallback(
    (selected: number[]) => {
      postSelection({ selected: [...selected] })
        .then((res) => {
          if (!res.ok) setSelectedState(currentSelectionRef.current);
        })
        .catch((e) => {
          console.error(e);
          setSelectedState(currentSelectionRef.current);
        });

      setSelectedState(selected);
    },
    [postSelection, setSelectedState, currentSelectionRef],
  );

  return { selected, setSelected, selectionStatus };
}
