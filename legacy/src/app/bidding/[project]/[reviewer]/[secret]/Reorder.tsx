import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

interface ReorderProps {
  i: number;
  selected: number[];
  setSelected: (selected: number[]) => void;
}

export function Reorder({ i, selected, setSelected }: ReorderProps) {
  const [open, setOpen] = useState(false);

  function onSelect(e: any) {
    const from = i;
    const to = Number(e);
    const newSet = [...selected];
    const [removed] = newSet.splice(from, 1);
    newSet.splice(to, 0, removed);
    setSelected(newSet);
  }

  if (i < 0) return <div className="w-12" />;

  return (
    <Select
      onOpenChange={setOpen}
      value={String(i)}
      onValueChange={onSelect}
      defaultValue={String(i + 1)}
    >
      <SelectTrigger className="flex  w-12 px-0 pt-0 gap-1 items-center justify-center border-none">
        <SelectValue placeholder={i + 1}>{i + 1}</SelectValue>
        <ChevronDown size={16} className="text-foreground/60" />
      </SelectTrigger>
      <SelectContent
        className="pointer-events-none"
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <div className="p-2 text-sm font-semibold">Change rank</div>
        <div className="max-h-64 overflow-auto">
          {selected.map((id, j) => {
            if (i === j) return null;
            return (
              <SelectItem key={id} value={String(j)}>
                {j + 1}
              </SelectItem>
            );
          })}
        </div>
      </SelectContent>
    </Select>
  );
}
