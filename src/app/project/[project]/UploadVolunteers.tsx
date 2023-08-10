'use client';

import CSVReader from '@/components/ui/csvUpload';
import { Loading } from '@/components/ui/loading';
import { Project } from '@/drizzle/schema';
import { useData, useUploadData } from '@/hooks/api';
import { useState } from 'react';
import { FaCheck } from 'react-icons/fa';

const submissionFields = ['id', 'email'];
interface Props {
  project: Project;
}

export default function UploadVolunteers({ project }: Props) {
  const { data, isLoading, mutate } = useData(project?.id, 'volunteers');
  const [status, setStatus] = useState({ loading: false, error: '' });

  const { trigger: uploadVolunteers } = useUploadData(project?.id, 'volunteers');

  function onUpload(data: Record<string, string>[]) {
    const emails = data.map((row) => row.email);
    const uniqueEmails = new Set(emails);
    if (emails.length !== uniqueEmails.size) {
      setStatus({ loading: false, error: 'Duplicate email found' });
      return;
    }

    setStatus({ loading: true, error: '' });

    uploadVolunteers({ data })
      .then(() => setStatus({ loading: false, error: '' }))
      .catch((e) => {
        setStatus({ loading: false, error: e.message });
      })
      .finally(() => mutate());
  }

  if (status.loading) return <Loading msg="Uploading Volunteers" />;
  if (isLoading) return <Loading msg="Loading Data" />;
  if (data?.count)
    return (
      <div className="flex flex-col text-center">
        <button className="bg-red-400 p-1 rounded mt-2" onClick={() => onUpload([])}>
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
