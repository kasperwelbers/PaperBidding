import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { useCopyReferencePool, useReferencePool } from "@/hooks/api";
import { useState } from "react";

/** Lets planners opt in to the reference submissions that are uploaded and
 *  processed centrally, instead of uploading them themselves */
export default function ReferencePool({
  projectId,
  onCopied,
}: {
  projectId: number;
  onCopied: () => void;
}) {
  const { data: pool, mutate } = useReferencePool(projectId);
  const { trigger: copyPool } = useCopyReferencePool(projectId);
  const [status, setStatus] = useState({ loading: false, error: "", msg: "" });

  if (!pool?.available) return null;

  const missing = pool.total - pool.inProject;

  async function onClick() {
    setStatus({ loading: true, error: "", msg: "" });
    try {
      const res = await copyPool({});
      if (!res.ok) throw new Error(res.statusText || "Failed to add");
      const { added } = await res.json();
      setStatus({
        loading: false,
        error: "",
        msg: `Added ${added} reference submission${added === 1 ? "" : "s"}`,
      });
      mutate();
      onCopied();
    } catch (e: any) {
      setStatus({ loading: false, error: e.message, msg: "" });
    }
  }

  return (
    <div className="w-full border border-primary/40 bg-primary/5 rounded p-4 flex flex-col gap-3 text-sm">
      <div>
        <h5 className="mb-1">ICA reference submissions</h5>
        <p className="m-0">
          This year&apos;s submissions of all ICA divisions ({pool.total}) are
          already uploaded and processed centrally. Instead of uploading
          reference submissions yourself, you can just use these.
        </p>
      </div>
      {status.error && <div className="text-red-500">{status.error}</div>}
      {status.msg && <div className="text-green-700">{status.msg}</div>}
      {status.loading ? (
        <Loading msg="Adding reference submissions" />
      ) : missing > 0 ? (
        <Button onClick={onClick}>
          {pool.inProject > 0
            ? `Add ${missing} new ICA reference submissions`
            : `Use the ICA reference submissions`}
        </Button>
      ) : (
        <p className="m-0 italic">
          Your project includes all ICA reference submissions.
        </p>
      )}
    </div>
  );
}
