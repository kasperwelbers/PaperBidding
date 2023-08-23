'use client';

import { useProject } from '@/hooks/api';
import { Loading } from '@/components/ui/loading';
import { Error } from '@/components/ui/error';
import { useState } from 'react';

import UploadData from './UploadData';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

type Tab = 'submissions' | 'references' | 'volunteers';
const tabs: Tab[] = ['submissions', 'volunteers', 'references'];

export default function ProjectPage({ params }: { params: { project: number } }) {
  const { data: project, isLoading, error } = useProject(params.project);
  const router = useRouter();
  const [status, setStatus] = useState({
    submissions: false,
    volunteers: false
  });
  if (isLoading) return <Loading msg="Loading Project" />;
  if (error) return <Error msg={error.message} />;
  if (!project) return null; //shouldn't happen, but typescript

  return (
    <main className="flex flex-wrap justify-center p-10 gap-8">
      <div className="flex flex-col items-center">
        <h3>Preparing a project</h3>
        <div className="max-w-xl py-3">
          <p>
            A project first and foremost requires submissions to bid on. To upload submissions, you
            should have a CSV file in which each row is an abstract-author pair (so multipe rows per
            abstract if it has multiple authors).
          </p>
          <p>
            By default, every submission author is considered as a possible reviewer. Alternatively,
            you can upload a CSV file with a list of volunteers.
          </p>
          <p>
            Reviewers will be asked to bid on submissions, which will be sorted by similarity to
            their own submissions. If you have submissions from previous projects, you can upload
            them as reference submissions to improve this automatic matching.
          </p>
        </div>
        <Button
          disabled={!status.submissions}
          className="w-full"
          onClick={() =>
            router.push(`/project/${project.id}/manage/bidding?token=${project.editToken}`)
          }
        >
          Manage bidding
        </Button>
        <p className="text-red-600">
          {status.submissions ? '' : 'Need to upload submissions first'}
        </p>
      </div>
      <UploadData projectId={params.project} setStatus={setStatus} />
    </main>
  );
}
