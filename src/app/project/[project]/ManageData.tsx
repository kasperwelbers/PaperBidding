import { DataPage } from '@/types';
import { useState } from 'react';
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa';

export default function ManageData({
  dataPage,
  deleteData,
  setStatus
}: {
  dataPage: DataPage;
  deleteData: () => void;
  setStatus: (status: { loading: string; error: string }) => void;
}) {
  const [canDelete, setCanDelete] = useState(false);

  function onDelete() {
    setStatus({ loading: 'Deleting', error: '' });
    deleteData({})
      .then(() => setCanDelete(false))
      .finally(() => {
        dataPage.resetData();
        setStatus({ loading: '', error: '' });
      });
  }

  if (!dataPage.data?.length) return null;

  return (
    <div className="flex flex-col text-center">
      <div className="mb-5">
        <div className="flex gap-3 justify-center">
          <FaArrowLeft onClick={() => dataPage.prevPage?.()} />
          <FaArrowRight onClick={() => dataPage.nextPage?.()} />
        </div>
        <div className="max-w-full overflow-auto py-3">
          <table className="table-fixed text-left">
            <thead>
              <tr className="">
                {Object.keys(dataPage.data[0]).map((key) => (
                  <th className="px-3" key={key}>
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataPage.data.map((row, i) => (
                <tr key={i}>
                  {Object.keys(row).map((key) => {
                    let value: string;
                    if (typeof row[key] === 'object') {
                      value = JSON.stringify(row[key]);
                    } else if (typeof row[key] === 'boolean') {
                      value = row[key] ? 'true' : 'false';
                    } else {
                      value = row[key];
                    }
                    return (
                      <td
                        className="px-3 whitespace-nowrap max-w-[10rem] overflow-hidden overflow-ellipsis"
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
      <div className="flex gap-2">
        <span className="flex-auto text-right whitespace-nowrap">
          Type "I am certain" to enable delete
        </span>
        <input
          className="border-2 rounded border-gray-400 px-2 text-center w-20 flex-auto"
          onChange={(e) => {
            if (e.target.value === 'I am certain') setCanDelete(true);
            else setCanDelete(false);
          }}
        ></input>
      </div>
      <button
        disabled={!canDelete}
        className="bg-red-400 disabled:opacity-50 p-1 rounded mt-2"
        onClick={() => onDelete()}
      >
        Delete Current Data
      </button>
    </div>
  );
}
