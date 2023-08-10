'use client';

import { useProject } from '@/hooks/api';
import UploadSubmissions from './UploadSubmissions';
import { Loading } from '@/components/ui/loading';
import { Error } from '@/components/ui/error';
import useFeatureExtractor from '@/hooks/useFeatureExtractor';
import { useState } from 'react';
import UploadVolunteers from './UploadVolunteers';

type Tab = 'submissions' | 'references' | 'volunteers';
const tabs: Tab[] = ['submissions', 'volunteers', 'references'];

export default function ProjectPage({ params }: { params: { project: number } }) {
  const { modelStatus, extractFeatures } = useFeatureExtractor(true);
  const [selectedTab, setSelectedTab] = useState<Tab>('submissions');

  const { data: project, isLoading, error } = useProject(params.project);
  if (isLoading) return <Loading msg="Loading Project" />;
  if (modelStatus === 'loading') return <Loading msg="Loading Transformer Model" />;
  if (error) return <Error msg={error.message} />;
  if (!project) return null; //shouldn't happen, but typescript

  return (
    <main className="flex flex-wrap justify-center p-10 gap-8">
      <div className="flex flex-col gap-3 items-center p-4">
        <h3>Preparing a project</h3>
        <div className="max-w-xl">
          <p>
            A project requires submissions and volunteers, that are both uploaded as CSV files.
            Volunteers will be able to bid for reviewing submissions, and the submissions will be
            sorted by similarity to the volunteer's own submissions.
          </p>
          <p>
            Optionally, you can also upload reference submissions. This will not be used for
            bidding, but only for sorting the submissions by similarity. Simply put, if you have
            submissions from previous projects, upload them as references so that volunteers can
            more easily find submissions that relate to their own work
          </p>
        </div>
      </div>
      <div className="w-full max-w-md grid justify-center rounded border-2 border-gray-500 p-5">
        <h3 className="text-center">Upload Data</h3>
        <div className="flex gap-3 mb-6">
          {tabs.map((tab: Tab) => {
            const buttonColor =
              tab === selectedTab ? 'bg-blue-500 text-white' : 'bg-gray-300 text-black';
            return (
              <div
                key={tab}
                className={`flex-auto rounded ${buttonColor} cursor-pointer px-3 py-2 text-center`}
                onClick={() => setSelectedTab(tab)}
              >
                {tab}{' '}
              </div>
            );
          })}
        </div>
        <div key="submissions" className={selectedTab === 'submissions' ? '' : 'hidden'}>
          <UploadSubmissions project={project} extractFeatures={extractFeatures} />
        </div>
        <div key="volunteers" className={selectedTab === 'volunteers' ? '' : 'hidden'}>
          <UploadVolunteers project={project} />
        </div>
        <div key="references" className={selectedTab === 'references' ? '' : 'hidden'}>
          <UploadSubmissions project={project} extractFeatures={extractFeatures} reference />
        </div>
      </div>
    </main>
  );
}
