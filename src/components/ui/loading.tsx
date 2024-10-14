import { cn } from "@/lib/utils";

export function Loading({
  msg,
  className,
}: {
  msg?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        `flex h-full flex-col items-center justify-center p-12`,
        className,
      )}
    >
      <span className="loader"></span>
      <h2 className="text-2xl font-bold mt-3">{msg || "Loading..."}</h2>
    </div>
  );
}
