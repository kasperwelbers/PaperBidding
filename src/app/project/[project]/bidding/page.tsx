'use client';

import { Error } from '@/components/ui/error';
import { useAllData } from '@/hooks/api';

export default function Bidding({ params }: { params: { project: number } }) {
  const { allData, isLoading, error } = useAllData(params.project, 'reviewers');

  if (error) return <Error msg={error} />;

  return (
    <div className="flex flex-col ">
      {isLoading}
      <div className="p-5 whitespace-nowrap">
        <h1>Bidding</h1>
        <table className="table-fixed [&_td]:px-2 [&_th]:p-2 [&_th:first-child]:rounded-l [&_th:last-child]:rounded-r">
          <thead className="text-left bg-slate-300">
            <tr>
              <th>email</th>
              <th>link</th>
            </tr>
          </thead>
          <tbody>
            {allData?.map((reviewer) => {
              return (
                <tr>
                  <td>{reviewer.email}</td>
                  <td>
                    <a href={reviewer.link}>{reviewer.link}</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
