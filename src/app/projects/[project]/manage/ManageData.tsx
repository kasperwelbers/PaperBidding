import { Button } from "@/components/ui/button";
import { DataPage } from "@/types";
import { useState } from "react";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";

export default function ManageData({
  dataPage,
  deleteData,
  setStatus,
}: {
  dataPage: DataPage;
  deleteData: any;
  setStatus: (status: { loading: string; error: string }) => void;
}) {
  const [canDelete, setCanDelete] = useState(false);

  function onDelete() {
    if (!deleteData) return;
    setStatus({ loading: "Deleting", error: "" });
    deleteData({})
      .then(() => setCanDelete(false))
      .finally(() => {
        dataPage.reset();
        setStatus({ loading: "", error: "" });
      });
  }

  function changePage(e: MouseEvent, direction: "next" | "prev") {
    e.preventDefault();
    const fun = direction === "next" ? dataPage.nextPage : dataPage.prevPage;
    fun?.();
  }

  if (!dataPage.data) return null;

  return (
    <div className="flex flex-col text-center h-full">
      <div className="mb-5">
        <div className="flex flex-col justify-center select-none">
          <strong className="text-primary">{dataPage.n} items</strong>
          <div className="flex justify-end items-center gap-3">
            <FaArrowLeft
              onClick={(e: MouseEvent) => changePage(e, "prev")}
              className={`${dataPage.prevPage ? "cursor-pointer" : "opacity-50"}`}
            />
            <strong>{dataPage.page}</strong>
            <FaArrowRight
              onClick={(e: MouseEvent) => changePage(e, "next")}
              className={`${dataPage.nextPage ? "cursor-pointer" : "opacity-50"}`}
            />
          </div>
        </div>
        <div
          className={` overflow-auto pb-3 pt-1 ${dataPage.isLoading ? "opacity-50" : ""}`}
        >
          <table className="table-auto text-left">
            <thead>
              <tr className="">
                {Object.keys(dataPage.data[0]).map((key) => (
                  <th className="pr-3" key={key}>
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="min-h-[18rem]">
              {dataPage.data.map((row, i) => (
                <tr key={i}>
                  {Object.keys(row).map((key) => {
                    let value: string;
                    if (typeof row[key] === "object") {
                      value = JSON.stringify(row[key]);
                    } else if (typeof row[key] === "boolean") {
                      value = row[key] ? "true" : "false";
                    } else {
                      value = row[key];
                    }
                    return (
                      <td
                        className="pr-3 py-1 whitespace-nowrap max-w-[12rem] overflow-hidden overflow-ellipsis"
                        key={key}
                      >
                        <span title={value}>{value}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-auto">
        <span className="flex-auto text-right whitespace-nowrap">
          Type &quot;I am certain&quot; to enable delete
        </span>
        <input
          className="border-2 rounded border-gray-400 px-2 text-center w-20 flex-auto"
          onChange={(e) => {
            if (e.target.value === "I am certain") setCanDelete(true);
            else setCanDelete(false);
          }}
        ></input>
      </div>
      <Button
        disabled={!canDelete}
        className="bg-red-400 disabled:opacity-50 p-1 rounded mt-2"
        onClick={() => onDelete()}
      >
        Delete Current Data
      </Button>
    </div>
  );
}
