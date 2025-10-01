import React, { CSSProperties, useState } from "react";

import { useCSVReader } from "react-papaparse";
import { Button } from "./button";
import { Combobox } from "./combobox";
import { X } from "lucide-react";

interface Props {
  fields: { field: string; label: string }[];
  label: string;
  detail: string;
  onUpload: (data: Row[]) => void;
  defaultFields: Record<string, string>;
}
type Row = Record<string, string>;
interface SelectedColumns {
  id: number;
  name: string;
  STUPIDLOWERCASE: string;
}

export default function CSVReader({
  fields,
  label,
  detail,
  onUpload,
  defaultFields = {},
}: Props) {
  const { CSVReader } = useCSVReader();
  const [data, setData] = useState<{ headers: string[]; rows: string[][] }>();
  const [selectedColumns, setSelectedColumns] = useState<
    Record<string, SelectedColumns>
  >({});
  const allColumnsSelected = fields.every(
    (field) => selectedColumns[field.field],
  );

  const prepareUpload = () => {
    return data?.rows.map((row) => {
      const obj: Row = {};
      for (let [key, value] of Object.entries(selectedColumns)) {
        obj[key] = row[value.id];
      }
      return obj;
    });
  };

  const onUploadAccepted = (results: any) => {
    const data: string[][] = results.data;
    const headers = data[0];
    const rows = data.slice(1).filter((row) => {
      // ignore empty rows
      let allEmpty = true;
      for (let cell of row) if (cell) allEmpty = false;
      return !allEmpty;
    });
    setData({ headers, rows });

    const selectedColumns: Record<string, SelectedColumns> = {};
    for (let [key, value] of Object.entries(defaultFields)) {
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        const lowerHeader = header.toLowerCase();
        if (lowerHeader.includes(value.toLowerCase())) {
          selectedColumns[key] = {
            id: i,
            name: header,
            STUPIDLOWERCASE: lowerHeader,
          };
          if (lowerHeader === value.toLowerCase()) break;
        }
      }
    }
    setSelectedColumns(selectedColumns);
  };

  return (
    <div className="flex flex-col gap-8 h-full w-full">
      <div>
        {/* <h3 className="text-center">Upload Submissions CSV</h3> */}
        <CSVReader onUploadAccepted={onUploadAccepted}>
          {({ getRootProps, acceptedFile }: any) => (
            <div className="flex items-center gap-5">
              {!data ? (
                <Button
                  className="w-full h-full flex flex-col hover:text-white bg-white text-black border-2 border-dotted border-gray-700"
                  {...getRootProps()}
                >
                  <h5 className="mb-0">Click here to select file</h5>
                  {/* <p>{detail}</p> */}
                </Button>
              ) : (
                <div className="flex gap-3 w-full items-center justify-end">
                  <div className="font-bold text-center">
                    {acceptedFile?.name || "file"}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setData(undefined)}
                  >
                    <X className="" size={16} />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CSVReader>
      </div>
      <div className={`w-full ${data ? "" : "opacity-50 pointer-events-none"}`}>
        {/* <h3 className="">Select columns</h3> */}
        <div className="grid grid-cols-2 sm:grid-cols-[1fr,250px]  items-center gap-x-5 gap-y-1">
          {fields.map((field) => {
            return (
              <div key={field.field} className="contents">
                <div className="font-bold text-xs whitespace-nowrap md:text-base">
                  {field.label}
                </div>
                <Combobox
                  items={data?.headers || []}
                  label="column"
                  controlledValue={selectedColumns[field.field]?.name || ""}
                  onSelect={(value) => {
                    setSelectedColumns(
                      (selectedColumns: Record<string, SelectedColumns>) => {
                        return { ...selectedColumns, [field.field]: value };
                      },
                    );
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <Button
          className="flex-auto w-full "
          onClick={() => onUpload(prepareUpload() || [])}
          disabled={!allColumnsSelected || !data}
        >
          Upload
        </Button>
      </div>
    </div>
  );
}
