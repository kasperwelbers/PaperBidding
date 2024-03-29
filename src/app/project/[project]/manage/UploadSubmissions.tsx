'use client';

import { Loading } from '@/components/ui/loading';
import { useData, useDeleteData, useUploadData } from '@/hooks/api';
import CSVReader from '@/components/ui/csvUpload';
import { useState } from 'react';
import { ModelStatus, ProcessedSubmission, DataPage } from '@/types';
import { SubmissionsSchema } from '@/zodSchemas';
import ManageData from './ManageData';

const submissionFields = ['id', 'author_email', 'author_firstname', 'title', 'abstract'];
const defaultFields = {
  id: 'control id',
  author_email: '(e-mail)',
  author_firstname: '(First name)',
  title: 'title',
  abstract: 'abstract'
};

interface Props {
  projectId: number;
  modelStatus: ModelStatus;
  dataPage: DataPage;
  extractFeatures: (
    texts: string[],
    callback: (features: number[][]) => void,
    progressCallback: (percent: number) => void
  ) => void;
  reference?: boolean;
}

export default function UploadSubmissions({
  projectId,
  modelStatus,
  dataPage,
  extractFeatures,
  reference
}: Props) {
  const [status, setStatus] = useState({ loading: '', error: '' });

  const params = reference ? { reference } : {};
  const { trigger: uploadSubmissions } = useUploadData(projectId, 'submissions', params);
  const { trigger: deleteSubmissions } = useDeleteData(projectId, 'submissions', params);

  function onUpload(data: Record<string, string>[]) {
    setStatus({ loading: 'loading', error: '' });
    try {
      const submissionMap = new Map<string, ProcessedSubmission>();
      for (let row of data) {
        if (!submissionMap.has(row.id)) {
          submissionMap.set(row.id, {
            id: row.id,
            authors: [{ email: row.author_email, firstname: row.author_firstname }],
            title: row.title,
            abstract: row.abstract,
            features: []
          });
        } else {
          submissionMap
            .get(row.id)
            ?.authors.push({ email: row.author_email, firstname: row.author_firstname });
        }
      }
      const submissions: ProcessedSubmission[] = [...submissionMap.values()];
      const texts = submissions.map(
        (submission) => submission.title + '.\n\n' + submission.abstract
      );

      const callback = async (features: number[][]) => {
        // called when extractFeatures is finished
        for (let i = 0; i < features.length; i++) {
          submissions[i].features = [...features[i]];
        }

        try {
          SubmissionsSchema.parse(submissions);

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
          dataPage.reset();
          setStatus({ loading: '', error: '' });
        } catch (e) {
          console.error(e);
          setStatus({ loading: '', error: 'Failed to upload' });
        }
      };

      const progressCallback = (percent: number) => {
        // called when extractFeatures is running to report progress
        setStatus({
          loading: `Preprocessing (${Math.round(percent * 100)}%)`,
          error: ''
        });
      };

      extractFeatures(texts, callback, progressCallback);
    } catch (e: any) {
      console.error(e);
      setStatus({ loading: '', error: e.message });
    }
  }

  if (modelStatus === 'loading') return <Loading msg="Loading Model" />;
  if (dataPage.isLoading && !dataPage.data?.length) return <Loading msg="Loading Data" />;
  if (status.loading) return <Loading msg={status.loading} />;

  if (dataPage.data && dataPage.data.length > 0)
    return <ManageData dataPage={dataPage} deleteData={deleteSubmissions} setStatus={setStatus} />;

  return (
    <>
      {status.error && <div className="text-red-500">{status.error}</div>}
      <CSVReader
        fields={submissionFields}
        label="Submissions"
        detail="Requires columns for id, author (email and firstname), title and abstract. Use multiple rows for different
      authors."
        onUpload={onUpload}
        defaultFields={defaultFields}
      />
    </>
  );
}
