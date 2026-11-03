import { useReferencePool } from "@/hooks/api";

/** Tells planners that the centrally uploaded ICA reference submissions are
 *  used automatically, so they don't need to upload them themselves */
export default function ReferencePool({ projectId }: { projectId: number }) {
  const { data: pool } = useReferencePool(projectId);
  if (!pool?.available) return null;

  return (
    <div className="w-full border border-green-300 bg-green-50 rounded p-4 text-sm">
      <h5 className="mb-1">ICA reference submissions are used automatically</h5>
      <p className="m-0">
        This year&apos;s submissions of all ICA divisions ({pool.total}) are
        uploaded and processed centrally. For every reviewer, their submissions
        in other divisions are already used for matching, so you do not need to
        upload these yourself. You can still upload other reference submissions
        below, such as submissions from previous years.
      </p>
    </div>
  );
}
