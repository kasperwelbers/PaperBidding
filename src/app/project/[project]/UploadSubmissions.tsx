'use client';

import { Loading } from '@/components/ui/loading';
import { useData, useDeleteData, useUploadData } from '@/hooks/api';
import CSVReader from '@/components/ui/csvUpload';
import { useState } from 'react';
import { ProcessedSubmission } from '@/types';
import { SubmissionsSchema } from '@/schemas';

const submissionFields = ['id', 'author', 'title', 'abstract'];
interface Props {
  projectId: number;
  data: {
    data: {
      count: number;
    };
    isLoading: boolean;
    mutate: () => void;
  };
  extractFeatures: (
    texts: string[],
    callback: (features: number[][]) => void,
    progressCallback: (percent: number) => void
  ) => void;
  reference?: boolean;
}

export default function UploadSubmissions({ projectId, data, extractFeatures, reference }: Props) {
  const what = reference ? 'references' : 'submissions';
  const [status, setStatus] = useState({ loading: '', error: '' });
  const { trigger: uploadSubmissions } = useUploadData(projectId, what);
  const { trigger: deleteSubmissions } = useDeleteData(projectId, what);
  const [canDelete, setCanDelete] = useState(false);
  const { data: currentData, isLoading, mutate } = data;

  function onUpload(data: Record<string, string>[]) {
    setStatus({ loading: 'loading', error: '' });
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

      const callback = async (features: number[][]) => {
        for (let i = 0; i < features.length; i++) {
          submissions[i].features = [...features[i]];
        }

        try {
          SubmissionsSchema.parse(submissions);
        } catch (e) {
          console.error(e);
          setStatus({ loading: '', error: 'Invalid columns' });
          return;
        }

        const batchSize = 10;
        let batch: ProcessedSubmission[] = [];
        for (let i = 0; i < submissions.length; i++) {
          batch.push(submissions[i]);
          if (batch.length === batchSize || i === submissions.length - 1) {
            setStatus({
              loading: `Uploading ${Math.min(i + batchSize, submissions.length)}/${
                submissions.length
              }}`,
              error: ''
            });
            await uploadSubmissions({ data: batch });
            batch = [];
          }
        }
        mutate();
        setStatus({ loading: '', error: '' });
      };

      const progressCallback = (percent: number) => {
        setStatus({ loading: `Preprocessing (${Math.round(percent * 100)}%)`, error: '' });
      };

      extractFeatures(texts, callback, progressCallback);
    } catch (e: any) {
      console.error(e);
      setStatus({ loading: '', error: e.message });
    }
  }

  function onDelete() {
    setStatus({ loading: 'Deleting', error: '' });
    deleteSubmissions().finally(() => {
      mutate();
      setStatus({ loading: '', error: '' });
    });
  }

  if (isLoading) return <Loading msg="Loading Data" />;
  if (status.loading) return <Loading msg={status.loading} />;

  if (currentData.count)
    return (
      <div className="flex flex-col text-center">
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

  return (
    <>
      {status.error && <div className="text-red-500">{status.error}</div>}
      <CSVReader
        fields={submissionFields}
        label="Submissions"
        detail="Requires columns for id, author, title and abstract. Use multiple rows for different
      authors."
        onUpload={onUpload}
      />
    </>
  );
}
