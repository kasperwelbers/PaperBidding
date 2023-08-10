'use client';

import { Loading } from '@/components/ui/loading';
import { Error } from '@/components/ui/error';
import { useData, useUploadData } from '@/hooks/api';
import useFeatureExtractor from '@/hooks/useFeatureExtractor';
import CSVReader from '@/components/ui/csvUpload';
import { useState } from 'react';
import { ProcessedSubmission } from '@/types';
import { Project } from '@/drizzle/schema';

const submissionFields = ['id', 'author', 'title', 'abstract'];
interface Props {
  project: Project;
  extractFeatures: (
    texts: string[],
    callback: (features: number[][]) => void,
    progressCallback: (percent: number) => void
  ) => void;
  reference?: boolean;
}

export default function UploadSubmissions({ project, extractFeatures, reference }: Props) {
  const what = reference ? 'references' : 'submissions';
  const { data, isLoading, mutate } = useData(project?.id, what);
  const [status, setStatus] = useState({ loading: false, error: '', percent: 0 });
  const { trigger: uploadSubmissions } = useUploadData(project?.id, what);

  function onUpload(data: Record<string, string>[]) {
    data = data.slice(0, 5);
    setStatus({ loading: true, error: '', percent: 0 });
    try {
      const submissionMap = new Map<string, ProcessedSubmission>();
      for (let row of data) {
        if (!submissionMap.has(row.id)) {
          submissionMap.set(row.id, {
            id: row.id,
            authors: [row.author],
            title: row.title,
            abstract: row.abstract,
            features: []
          });
        } else {
          submissionMap.get(row.id)?.authors.push(row.author);
        }
      }
      const submissions: ProcessedSubmission[] = [...submissionMap.values()];
      const texts = submissions.map(
        (submission) => submission.title + '.\n\n' + submission.abstract
      );

      const callback = (features: number[][]) => {
        for (let i = 0; i < features.length; i++) {
          submissions[i].features = features[i];
        }

        console.log(submissions);
        uploadSubmissions({ data: submissions })
          .then(() => setStatus({ loading: false, error: '', percent: 0 }))
          .catch((e) => {
            setStatus({ loading: false, error: e.message, percent: 0 });
          })
          .finally(() => mutate());
      };
      const progressCallback = (percent: number) => {
        setStatus({ loading: true, percent, error: '' });
      };

      extractFeatures(texts, callback, progressCallback);
    } catch (e: any) {
      setStatus({ loading: false, error: e.message, percent: 0 });
    }
  }

  if (isLoading) return <Loading msg="Loading Data" />;
  if (status.loading)
    return <Loading msg={`Preprocessing (${Math.round(status.percent * 100)}%)`} />;

  if (data?.count)
    return (
      <div className="flex flex-col text-center">
        <button className="bg-red-400 p-1 rounded mt-2" onClick={() => onUpload([])}>
          Delete Current Data
        </button>
      </div>
    );

  return (
    <CSVReader
      fields={submissionFields}
      label="Submissions"
      detail="Requires columns for id, author, title and abstract. Use multiple rows for different
                authors."
      onUpload={onUpload}
    />
  );
}
