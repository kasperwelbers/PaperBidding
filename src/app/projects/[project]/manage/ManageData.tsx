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
                {Object.keys(dataPage.data[0]).map((key) => {
                  if (key === "id") return null;
                  if (key === "features") return null;
                  return (
                    <th className="pr-3" key={key}>
                      {key}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="min-h-[18rem]">
              {dataPage.data.map((row, i) => (
                <tr key={i}>
                  {Object.keys(row).map((key) => {
                    let value: string;
                    if (key === "id") return null;
                    if (key === "features") return null;
                    if (typeof row[key] === "object") {
                      if (key === "features") {
                        value = `vector (${row[key].length})`;
                      } else if (key === "authors") {
                        value = row[key].join(", ");
                      } else {
                        value = JSON.stringify(row[key]);
                      }
                    } else if (typeof row[key] === "boolean") {
                      value = row[key] ? "true" : "false";
                    } else {
                      value = row[key];
                    }
                    return (
                      <td
                        className="pr-3 py-1 whitespace-nowrap max-w-[18rem] overflow-hidden overflow-ellipsis"
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
      <div className="flex flex-wrap gap-2 mt-auto items-center border-t pt-6">
        <span className="flex-auto text-right opacity-70 max-w-[25rem]">
          To re-upload data, you need to delete the current data first. Type
          &quot;I am certain&quot; to enable delete
        </span>
        <input
          className="border-2 h-10 rounded border-gray-400 px-2  w-36 min-w-0 ml-auto"
          placeholder="I am certain"
          onChange={(e) => {
            if (e.target.value.toLowerCase() === "i am certain")
              setCanDelete(true);
            else setCanDelete(false);
          }}
        ></input>
      </div>
      <Button
        disabled={!canDelete}
        className="ml-auto bg-red-400 disabled:opacity-50 p-1 rounded mt-2 w-36"
        onClick={() => onDelete()}
      >
        Delete Data
      </Button>
    </div>
  );
}
