import { Button } from "@/components/ui/button";
import { ReactNode } from "react";
import {
  FaCheck,
  FaCheckCircle,
  FaCheckSquare,
  FaSquareFull,
} from "react-icons/fa";

interface Props {
  title: string;
  hint: string;
  doneMsg: string;
  done: boolean;
  onClick?: () => void;
  disabled?: boolean;
  optional?: boolean;
  loading?: boolean;
}

export default function Step({
  title,
  hint,
  doneMsg,
  done,
  onClick,
  disabled,
  optional,
  loading,
}: Props) {
  function renderMsg() {
    if (loading) return <span className="text-blue-500">loading...</span>;
    if (done) return doneMsg;
    if (!optional) return hint;
    return (
      <>
        <span className="border rounded px-2 text-md text-yellow-800 ">
          optional
        </span>
        {hint}
      </>
    );
  }

  return (
    <Button
      disabled={disabled}
      variant="ghost"
      className="flex h-max flex-start text-left hover:scale-105 transition-transform"
      onClick={onClick}
    >
      <div className="flex-auto ">
        <h4 className="mb-1">{title}</h4>
        <p className=" opacity-70 flex gap-3 items-center">{renderMsg()}</p>
      </div>
      {done ? <FaCheck color="green" size={26} /> : null}
    </Button>
  );
}
