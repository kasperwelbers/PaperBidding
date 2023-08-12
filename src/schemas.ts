import { z } from 'zod';

export const VolunteersSchema = z.array(
  z.object({
    id: z.string(),
    email: z.string() // (the .email() validation is broken)
  })
);

export const SubmissionsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    abstract: z.string(),
    features: z.array(z.number()),
    authors: z.array(z.string())
  })
);
