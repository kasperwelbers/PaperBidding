'use client';

import { useData, useProject } from '@/hooks/api';
import UploadSubmissions from './UploadSubmissions';
import { Loading } from '@/components/ui/loading';
import { Error } from '@/components/ui/error';
import useFeatureExtractor from '@/hooks/useFeatureExtractor';
import { useState } from 'react';
import UploadVolunteers from './UploadVolunteers';
import { MdOutlineCheckBoxOutlineBlank, MdOutlineCheckBox } from 'react-icons/md';
import UploadData from './UploadData';

type Tab = 'submissions' | 'references' | 'volunteers';
const tabs: Tab[] = ['submissions', 'volunteers', 'references'];

export default function ProjectPage({ params }: { params: { project: number } }) {
  const { data: project, isLoading, error } = useProject(params.project);
  if (isLoading) return <Loading msg="Loading Project" />;
  if (error) return <Error msg={error.message} />;
  if (!project) return null; //shouldn't happen, but typescript

  return (
    <main className="flex flex-wrap justify-center p-10 gap-8">
      <div className="flex flex-col gap-3 items-center">
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
      <UploadData projectId={params.project} />
    </main>
  );
}
