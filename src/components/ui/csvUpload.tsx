import React, { CSSProperties, useState } from "react";

import { useCSVReader } from "react-papaparse";
import { Button } from "./button";
import { Combobox } from "./combobox";

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
    <div className="flex flex-col gap-8 h-full">
      <div>
        {/* <h3 className="text-center">Upload Submissions CSV</h3> */}
        <CSVReader onUploadAccepted={onUploadAccepted}>
          {({ getRootProps }: any) => (
            <div className="flex items-center gap-5">
              <Button
                className="w-full h-full flex flex-col hover:text-white bg-white text-black border-2 border-dotted border-gray-700"
                {...getRootProps()}
              >
                <h5 className="mb-0">Click here to select file</h5>
                {/* <p>{detail}</p> */}
              </Button>
              {/* <div className="flex-auto max-w-[400px] text-[1rem] leading-[1.2rem]">{detail}</div> */}
            </div>
          )}
        </CSVReader>
      </div>
      <div className={` ${data ? "" : "opacity-50 pointer-events-none"}`}>
        {/* <h3 className="">Select columns</h3> */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr,250px]  items-center gap-x-5 gap-y-1">
          {fields.map((field) => {
            return (
              <div key={field.field} className="contents">
                <div className="font-bold">{field.label}</div>
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
      <div
        className={` ${allColumnsSelected ? "" : "opacity-50 pointer-events-none mt-auto"}`}
      >
        <Button
          className="flex-auto w-full "
          onClick={() => onUpload(prepareUpload() || [])}
        >
          Upload
        </Button>
      </div>
    </div>
  );
}
