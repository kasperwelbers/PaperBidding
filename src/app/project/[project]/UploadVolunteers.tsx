'use client';

import CSVReader from '@/components/ui/csvUpload';
import { Loading } from '@/components/ui/loading';
import { useData, useDeleteData, useUploadData } from '@/hooks/api';
import { useState } from 'react';

const submissionFields = ['id', 'email'];
interface Props {
  data: {
    data: {
      count: number;
    };
    isLoading: boolean;
    mutate: () => void;
  };
  projectId: number;
}

export default function UploadVolunteers({ projectId, data }: Props) {
  const [status, setStatus] = useState({ loading: '', error: '' });
  const [canDelete, setCanDelete] = useState(false);
  const { data: currentData, isLoading, mutate } = data;

  const { trigger: uploadVolunteers } = useUploadData(projectId, 'volunteers');
  const { trigger: deleteVolunteers } = useDeleteData(projectId, 'volunteers');

  async function onUpload(data: Record<string, string>[]) {
    const emails = data.map((row) => row.email);

    if (emails.length !== new Set(emails).size) {
      setStatus({ loading: '', error: 'Duplicate email found' });
      return;
    }
    for (let i = 0; i < emails.length; i++) {
      if (!emails[i]) {
        setStatus({ loading: '', error: `Empty email found (row ${i + 2})` });
        return;
      }
    }

    setStatus({ loading: 'Uploading', error: '' });

    try {
      const batchSize = 100;
      let batch: ProcessedSubmission[] = [];
      for (let i = 0; i < data.length; i++) {
        batch.push(data[i]);
        if (batch.length === batchSize || i === data.length - 1) {
          setStatus({
            loading: `Uploading ${Math.min(i + batchSize, data.length)}/${data.length}}`,
            error: ''
          });
          await uploadVolunteers({ data: batch });
          batch = [];
        }
      }
      setStatus({ loading: '', error: '' });
      mutate();
    } catch (e) {
      setStatus({ loading: '', error: e.message });
    }
  }

  function onDelete() {
    setStatus({ loading: 'Deleting', error: '' });
    deleteVolunteers()
      .then(() => setCanDelete(false))
      .finally(() => {
        mutate();
        setStatus({ loading: '', error: '' });
      });
  }

  if (status.loading) return <Loading msg={status.loading} />;
  if (isLoading) return <Loading msg="Loading Data" />;

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
        detail="Requires columns for person ID and email."
        onUpload={onUpload}
      />
    </>
  );
}
