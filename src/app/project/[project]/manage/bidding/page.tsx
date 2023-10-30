'use client';

import { Button } from '@/components/ui/button';
import { Error } from '@/components/ui/error';
import { Loading } from '@/components/ui/loading';
import { useAllData } from '@/hooks/api';
import { GetReviewer, GetMetaSubmission, Bidding } from '@/types';
import { useState } from 'react';
import { FaArrowLeft, FaEye } from 'react-icons/fa';
import { useCSVDownloader } from 'react-papaparse';
import Invitations from './Invitations';
import downloadSubmissions from './downloadSubmissions';
import Link from 'next/link';

export default function Bidding({ params }: { params: { project: number } }) {
  const { CSVDownloader, Type } = useCSVDownloader();

  const {
    data: reviewers,
    isLoading: reviewersLoading,
    error: reviewersError
  } = useAllData<GetReviewer>(params.project, 'reviewers');
  const {
    data: submissions,
    isLoading: submissionsLoading,
    error: submissionsError
  } = useAllData<GetMetaSubmission>(params.project, 'submissions', undefined, true);

  if (reviewersError) return <Error msg={reviewersError.message} />;
  if (submissionsError) return <Error msg={submissionsError.message} />;
  if (reviewersLoading || submissionsLoading) return <Loading msg="Loading Reviewers" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 items-center md:items-start justify-center mt-6 w-full">
      <div className="p-5 pt-0 whitespace-nowrap overflow-auto">
        <Link
          as="button"
          href={`/project/${params.project}/manage`}
          className=" block w-min border-primary border-2 rounded flex items-center  gap-3 whitespace-nowrap p-2"
        >
          <FaArrowLeft /> Go Back
        </Link>
        <div className="flex flex-col gap-8 mt-2">
          <div className="grid grid-cols-[1fr,2fr] items-center gap-4 border-2 border-primary rounded-lg p-3">
            <div className="flex flex-col gap-2">
              <h3 className="text-center">Assignments</h3>
              <CSVDownloader
                type={Type.Button}
                className="flex-auto w-full bg-secondary text-primary p-1 rounded hover:text-secondary hover:bg-primary transition-colors "
                filename={`submission_biddings_${params.project}.csv`}
                bom={true}
                data={() => downloadSubmissions(reviewers || [], submissions || [], 'submissions')}
              >
                per submission
              </CSVDownloader>
              <CSVDownloader
                type={Type.Button}
                className="flex-auto w-full bg-secondary text-primary p-1 rounded hover:text-secondary hover:bg-primary transition-colors "
                filename={`reviewer_biddings_${params.project}.csv`}
                bom={true}
                data={() => downloadSubmissions(reviewers || [], submissions || [], 'reviewers')}
              >
                per reviewer
              </CSVDownloader>
            </div>
            <p className="whitespace-normal">
              Three reviewers are assigned to every submission. You can get both the reviewers per
              submission and the submission per reviewer.
            </p>
          </div>
          <Invitations reviewers={reviewers || []} />
        </div>
      </div>
      <div className="relative ">
        <h3 className="text-center">Reviewers</h3>

        <div className="relative overflow-y-auto m-5 pt-0 mt-5 pb-5 max-h-[30rem] overflow-auto border-b-2 border-primary">
          <table className="w-full table-auto [&_td]:px-2 [&_th]:p-2 [&_th:first-child]:rounded-l [&_th:last-child]:rounded-r ">
            <thead className="sticky top-0 text-left bg-slate-300">
              <tr>
                <th>email</th>
                <th className="text-right">invitation sent</th>
                <th className="text-right">bids</th>
                <th className="text-right"></th>
              </tr>
            </thead>
            <tbody>
              {reviewers?.map((reviewer) => {
                return (
                  <tr key={reviewer.email}>
                    <td>{reviewer.email}</td>
                    <td className="text-right">{reviewer.invitationSent || 'Not yet'}</td>
                    <td className="text-right">{reviewer?.biddings?.length}</td>
                    <td className="text-right">
                      <a href={reviewer.link}>
                        <div className="border-2 border-primary rounded p-1 m-1 mr-0 w-8 flex justify-center">
                          <FaEye />
                        </div>
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
