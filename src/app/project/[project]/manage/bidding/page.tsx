'use client';

import { Button } from '@/components/ui/button';
import { Error } from '@/components/ui/error';
import { Loading } from '@/components/ui/loading';
import { useAllData } from '@/hooks/api';
import { GetReviewer, GetMetaSubmission, Bidding } from '@/types';
import { useState } from 'react';
import { FaEye } from 'react-icons/fa';
import { useCSVDownloader } from 'react-papaparse';
import Invitations from './Invitations';

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
  } = useAllData<GetMetaSubmission>(params.project, 'submissions_meta');

  if (reviewersError) return <Error msg={reviewersError.message} />;
  if (submissionsError) return <Error msg={submissionsError.message} />;
  if (reviewersLoading || submissionsLoading) return <Loading msg="Loading Reviewers" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 items-center md:items-start justify-center mt-6 w-full">
      <div className="p-5 whitespace-nowrap overflow-auto ">
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-[1fr,2fr] items-center gap-4 border-2 border-primary rounded p-3">
            <div>
              <h3 className="text-center">Biddings</h3>
              <CSVDownloader
                type={Type.Button}
                className="w-full "
                filename={`submission_biddings_${params.project}.csv`}
                bom={true}
                data={() => downloadSubmissions(reviewers || [], submissions || [])}
              >
                <Button className="w-full bg-secondary text-primary hover:text-secondary">
                  Download
                </Button>
              </CSVDownloader>
            </div>
            <p className="whitespace-normal">
              Download the submission with all reviewer biddings, and a selection of three reviewers
              per submission
            </p>
          </div>
          <Invitations reviewers={reviewers || []} />
        </div>
      </div>
      <div className="overflow-auto p-5 pb-10 ">
        <h3 className="text-center">Reviewers</h3>

        <table className="w-full table-auto [&_td]:px-2 [&_th]:p-2 [&_th:first-child]:rounded-l [&_th:last-child]:rounded-r">
          <thead className="text-left bg-slate-300">
            <tr>
              <th>email</th>
              <th className="text-right">invitation sent</th>
              <th className="text-right">bids</th>
              <th className="text-right"></th>
            </tr>
          </thead>
          <tbody>
            {reviewers?.map((reviewer) => {
              console.log(reviewer);
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
  );
}

function downloadSubmissions(reviewers: GetReviewer[], submissions: GetMetaSubmission[]) {
  const reviewersPerSubmission = 3; // TODO: make this a parameter
  const biddingMap = new Map<number, Bidding[]>();
  const reviewerCount = new Map<string, number>();

  // copy submissions so we don't mutate the original
  submissions = submissions.map((submission) => ({ ...submission }));

  for (const reviewer of reviewers) {
    let i = 1;
    reviewerCount.set(reviewer.email, 0);
    for (const internalId of reviewer.biddings) {
      if (!biddingMap.has(internalId)) biddingMap.set(internalId, []);

      const biddingsArray = biddingMap.get(internalId);
      biddingsArray?.push({
        reviewer: reviewer.email,
        rank: i++
      });
    }
  }

  const maxPerReviewer = Math.ceil(
    (submissions.length * reviewersPerSubmission) / reviewers.length
  );

  for (const submission of submissions) {
    // biddings is total set of biddings
    const biddings = biddingMap.get(submission.id);
    if (!biddings) {
      submission.reviewers = [];
      continue;
    }
    submission.biddings = biddings;

    // compute selected [reviewersPerSubmission] reviewers
    // remove reviewers that have already been assigned maxPerReviewer submissions
    biddings.filter((b) => (reviewerCount.get(b.reviewer) || 0) < maxPerReviewer);
    // shuffle so no reviewers are more likely to get their preference
    biddings.sort(() => Math.random() - 0.5);
    // then sort by rank and reviewerCount (i.e. how often reviewer has already been assigned)
    biddings.sort((a: Bidding, b: Bidding) => {
      if (a.rank === b.rank)
        return (reviewerCount.get(a.reviewer) || 0) - (reviewerCount.get(b.reviewer) || 0);
      return a.rank - b.rank;
    });

    submission.reviewers = biddings.slice(0, reviewersPerSubmission).map((b) => b.reviewer);
    submission.reviewers.forEach((reviewer, i) => {
      reviewerCount.set(reviewer, (reviewerCount.get(reviewer) || 0) + 1);
    });
  }

  submissions = fillRemaining(submissions, reviewerCount, reviewersPerSubmission);

  return submissions.map((submission) => {
    const data: Record<string, any> = { ...submission };
    for (let i = 0; i < data.reviewers.length; i++) {
      data['reviewer_' + (i + 1)] = data.reviewers[i];
    }
    data.biddings = JSON.stringify(data.biddings);
    return data;
  });
}

function fillRemaining(
  submissions: GetMetaSubmission[],
  reviewerCount: Map<string, number>,
  reviewersPerSubmission: number
) {
  // if any submissions have less than 3 biddings, we need to fill them up randomly.
  const remaining = Array.from(reviewerCount)
    .map(([email, count]) => ({ email, count }))
    .sort((a, b) => a.count - b.count)
    .map((a) => a.email);

  for (const submission of submissions) {
    for (let i = 0; i < reviewersPerSubmission; i++) {
      if (!submission.reviewers[i]) {
        submission.reviewers[i] = pickNext(remaining, submission.reviewers) || '';
      }
    }
  }

  return submissions;
}

function pickNext(remaining: string[], exclude: string[]) {
  for (let i = 0; i < remaining.length; i++) {
    if (!exclude.includes(remaining[i])) {
      const pick = remaining[i];
      remaining.splice(i, 1);
      remaining.push(pick);
      return pick;
    }
  }
}
