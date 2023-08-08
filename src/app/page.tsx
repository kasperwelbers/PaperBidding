'use client';

import useFeatureExtractor from '@/hooks/useFeatureExtractor';
import { FeatureVector, ProcessedSubmission, Submission } from '@/types';
import { useState, useEffect } from 'react';

export default function Upload() {
  const { modelStatus, prepareModel, extractFeatures } = useFeatureExtractor();
  const [referenceText, setReferenceText] = useState<string>('');
  const [referenceVector, setReferenceVector] = useState<FeatureVector>([]);
  const [processedSubmissions, setProcessedSubmissions] = useState<ProcessedSubmission[]>([]);
  const [submissions, _] = useState<Submission[]>([
    {
      id: '1623455',
      authors: ['Anna', 'Bob'],
      title: 'sports',
      abstract: 'This is a text about sports'
    },
    {
      id: '2543534',
      authors: ['Claire'],
      title: 'football one',
      abstract: "I really don't like football"
    },
    {
      id: '3353454',
      authors: ['Anna', 'David'],
      title: 'football two',
      abstract: 'But many people do like football'
    },
    {
      id: '4534534',
      authors: ['Emma', 'Frank'],
      title: 'Food',
      abstract: 'I like food better'
    },
    {
      id: '5634534',
      authors: ['Claire', 'Frank'],
      title: 'Pancakes',
      abstract: 'Suddenly craving pancakes'
    }
  ]);

  useEffect(() => {
    extractFeatures([referenceText], (featureVectors) => {
      setReferenceVector(featureVectors[0]);
    });
  }, [referenceText, extractFeatures]);

  function processSubmissions(submissions: Submission[]) {
    const texts = submissions.map((submission) => submission.title + '.\n\n' + submission.abstract);
    extractFeatures(texts, (featureVectors) => {
      console.log(featureVectors);
      const newSubmissions = submissions.map((submission, i) => ({
        ...submission,
        vector: featureVectors[i]
      }));
      setProcessedSubmissions(newSubmissions);
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12">
      <h1 className="text-5xl font-bold mb-2 text-center">Paper Bidding</h1>
      <h2 className="text-2xl mb-10 text-center">
        Test case for running transformer-based semantic similarity in browser
      </h2>

      <div key="submissions" className="grid grid-cols-2 gap-3">
        <div className="font-bold text-3xl text-center ">Submission</div>
        <div>
          <div className="font-bold text-3xl text-center">Reference text</div>
          <div className="">
            <input
              value={referenceText}
              className="w-full rounded p-1 m-2 border-2 border-gray-300"
              placeholder="type reference text"
              onChange={(e) => setReferenceText(e.target.value)}
            />
          </div>
        </div>
        {processedSubmissions.map((submission, i) => {
          const similarity = cosineSimilarity(referenceVector || [], submission.vector || []);
          return (
            <div key={submission.id + i} className="contents text-center">
              <div className="grid  grid-cols-[10em,1fr]">
                <div className="font-bold">{submission.id} </div>
                <h3 className="font-bold mb-0">{submission.title} </h3>
                <div className="italic">{submission.authors.join(', ')} </div>
                <p>{submission.abstract} </p>
              </div>
              <div className={`text-green-700`}>{Math.round(similarity * 100) / 100 || ''}</div>{' '}
            </div>
          );
        })}
      </div>
      <div className="pt-10">
        {modelStatus === 'ready' ? (
          <button
            className="bg-slate-700 text-white p-3 rounded w-40"
            onClick={() => processSubmissions(submissions)}
          >
            Process texts
          </button>
        ) : (
          <button
            className="bg-slate-700 text-white p-3 rounded w-40"
            onClick={() => prepareModel()}
          >
            {modelStatus === 'idle' ? 'load model' : ''}
            {modelStatus === 'loading' ? 'loading...' : ''}
            {modelStatus === 'error' ? 'Error :(' : ''}{' '}
          </button>
        )}
      </div>
    </main>
  );
}

function cosineSimilarity(a: FeatureVector, b: FeatureVector) {
  if (a.length === 0 || a.length !== b.length) return NaN;
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
