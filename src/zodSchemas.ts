import { z } from "zod";

// The .string().email() validation appears to work poorly, so we don't use it.
// In particular fails with domains with many subdomains, which universities tend tot have.

export const NewProjectSchema = z.object({
  name: z.string(),
  division: z.string(),
  deadline: z.coerce.date(),
});

export const GetProjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  division: z.string(),
  deadline: z.coerce.date(),
  created: z.coerce.date(),
  creator: z.string(),
  admins: z.array(z.string()),
  archived: z.boolean(),
});

export const ReviewersSchema = z.array(
  z.object({
    email: z.string(),
    institution: z.string(),
    student: z.boolean(),
    canReview: z.boolean(),
  }),
);

export const UpdateReviewerSchema = z.object({
  email: z.string(),
  institution: z.string().optional(),
  student: z.boolean().optional(),
  canReview: z.boolean().optional(),
});

export const SubmissionsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    abstract: z.string(),
    features: z.array(z.number()),
    authors: z.array(z.string()),
    institutions: z.array(z.string()),
  }),
);

export const BidsSchema = z.object({
  submission: z.number(),
  delete: z.boolean().optional(),
});

export const ByReviewer = z
  .object({
    reviewer: z.string(),
    student: z.string(),
    canReview: z.string(),
  })
  .catchall(z.string());

export const BySubmission = z
  .object({
    submission_id: z.string(),
    title: z.string(),
    authors: z.string(),
  })
  .catchall(z.string());

export const AssignmentsSchema = z.object({
  byReviewer: z.array(ByReviewer),
  bySubmission: z.array(BySubmission),
  settings: z.object({
    autoPenalty: z.number(),
    reviewersPerSubmission: z.number(),
    maxStudentReviewers: z.number(),
    includeWho: z.enum(["all", "authors", "authors or bidders"]),
  }),
});

export const GetAssignmentsSchema = AssignmentsSchema.extend({
  lastUpdate: z.coerce.date(),
  lastBid: z.coerce.date().nullish(),
});
