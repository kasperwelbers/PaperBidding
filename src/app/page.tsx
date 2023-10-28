'use client';

import useFeatureExtractor from '@/hooks/useFeatureExtractor';
import { FeatureVector, ProcessedSubmission, Submission } from '@/types';
import { useState, useEffect } from 'react';

export default function Upload() {
  return (
    <main className="flex min-h-screen flex-col items-center p-12">
      <div className="max-w-4xl ">
        <h1 className="text-5xl font-bold mb-2 text-center">Paper Bidding</h1>
        <h4 className="mt-12">
          Welcome to the new paper bidding website of the ICA Computational Methods Division!
        </h4>
        <p className="text-left mt-12">
          Since you&apos;re here, I regret to inform you that you&apos;re actually in the wrong
          place... You should have received an email with a link that includes you&apos;re unique
          token. Please use that link to access the website.
        </p>
      </div>
    </main>
  );
}
