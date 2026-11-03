// Bidding invitations: an email with a personal bidding link, sent through
// the queue in batches.

import { and, eq, inArray } from "drizzle-orm";
import { conferences, divisionEditions, divisions, invitations, personIdentifiers, reviewers, type Db } from "@cp/db";
import { getEmailSender } from "./email";
import { chunk } from "./imports/d1";

export const INVITATIONS_PER_MESSAGE = 25;

export const defaultInvitation = {
  subject: "Paper bidding for {division}",
  body: `Dear reviewer,

The submissions for {division} ({conference}) are in, and it's time to review!

To help us assign the right reviewers to the right papers, please indicate which submissions match your expertise and interest. This personal link shows you the abstracts, sorted by similarity to your own work:

{link}

The deadline for bidding is {deadline}. If you do not bid, you will be matched to submissions based on similarity to your own work.

Happy bidding!`,
};

export function formatDeadline(deadline: Date) {
  return (
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(deadline) + " (UTC)"
  );
}

export function biddingLink(origin: string, divisionEditionId: number, reviewer: { id: number; secret: string }) {
  return `${origin.replace(/\/$/, "")}/bid/${divisionEditionId}/${reviewer.id}/${reviewer.secret}`;
}

function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => values[key] ?? m);
}

export interface InviteMessage {
  step: "invite";
  divisionEditionId: number;
  reviewerIds: number[];
  subject: string;
  body: string;
}

export async function sendInvitations(env: Env, db: Db, message: InviteMessage) {
  const de = await db.query.divisionEditions.findFirst({ where: eq(divisionEditions.id, message.divisionEditionId) });
  if (!de?.biddingDeadline) return;
  const division = (await db.query.divisions.findFirst({ where: eq(divisions.id, de.divisionId) }))!;
  const conference = (await db.query.conferences.findFirst({ where: eq(conferences.id, division.conferenceId) }))!;
  const sender = getEmailSender(env);

  const rows = await db
    .select({ id: reviewers.id, secret: reviewers.secret, personId: reviewers.personId })
    .from(reviewers)
    .where(and(inArray(reviewers.id, message.reviewerIds), eq(reviewers.editionId, de.editionId)));
  const emails = await db
    .select({ personId: personIdentifiers.personId, value: personIdentifiers.value })
    .from(personIdentifiers)
    .where(and(eq(personIdentifiers.kind, "email"), inArray(personIdentifiers.personId, rows.map((r) => r.personId))))
    .orderBy(personIdentifiers.id);

  const values = {
    division: division.name,
    conference: conference.name,
    deadline: formatDeadline(de.biddingDeadline),
  };
  for (const r of rows) {
    const to = emails.find((e) => e.personId === r.personId)?.value;
    if (!to) continue;
    const link = biddingLink(env.BETTER_AUTH_URL, de.id, r);
    let text = fill(message.body, { ...values, link });
    if (!message.body.includes("{link}")) text += `\n\n${link}`;
    try {
      await sender.send({ to, subject: fill(message.subject, { ...values, link }), text });
      await db
        .insert(invitations)
        .values({ divisionEditionId: de.id, reviewerId: r.id, sentAt: new Date() })
        .onConflictDoUpdate({ target: [invitations.divisionEditionId, invitations.reviewerId], set: { sentAt: new Date() } });
    } catch (e) {
      console.error(`invitation to reviewer ${r.id} failed`, e);
    }
  }
}

export function inviteMessages(base: Omit<InviteMessage, "reviewerIds" | "step">, reviewerIds: number[]): InviteMessage[] {
  return chunk(reviewerIds, INVITATIONS_PER_MESSAGE).map((ids) => ({ step: "invite", ...base, reviewerIds: ids }));
}
