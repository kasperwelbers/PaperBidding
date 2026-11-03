// Finding or creating persons for imported records.
//
// The platform person ID is the identity. Emails attach to a person:
// - a known person ID -> that person
// - otherwise a known email -> that person (unless they already have another
//   person ID: then it is a different person with the same email)
// - otherwise a new person
// An email that already belongs to another person is not moved; it is
// recorded as a conflict for the conference admin.

import { and, eq, inArray, sql } from "drizzle-orm";
import {
  editionPersons,
  importConflicts,
  personIdentifiers,
  persons,
  type Db,
} from "@cp/db";
import { chunkRows, chunkValues } from "./d1";

export interface PersonInput {
  personId?: string;
  emails: string[];
  name?: string;
  institution?: string;
}

export interface ImportContext {
  conferenceId: number;
  editionId: number;
  importJobId: number;
}

export interface ResolveResult {
  /** person id for every input, in order */
  ids: number[];
  created: number;
  conflicts: number;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function lookup(
  db: Db,
  conferenceId: number,
  kind: "platform_id" | "email",
  values: string[],
) {
  const found = new Map<string, number>();
  for (const part of chunkValues(values)) {
    const rows = await db
      .select({ value: personIdentifiers.value, personId: personIdentifiers.personId })
      .from(personIdentifiers)
      .where(
        and(
          eq(personIdentifiers.conferenceId, conferenceId),
          eq(personIdentifiers.kind, kind),
          inArray(personIdentifiers.value, part),
        ),
      );
    for (const r of rows) found.set(r.value, r.personId);
  }
  return found;
}

/** Person IDs of the given persons */
async function platformIdsOf(db: Db, personIds: number[]) {
  const found = new Map<number, string>();
  for (const part of chunkValues(personIds)) {
    const rows = await db
      .select({ value: personIdentifiers.value, personId: personIdentifiers.personId })
      .from(personIdentifiers)
      .where(
        and(eq(personIdentifiers.kind, "platform_id"), inArray(personIdentifiers.personId, part)),
      );
    for (const r of rows) found.set(r.personId, r.value);
  }
  return found;
}

export async function resolvePersons(
  db: Db,
  ctx: ImportContext,
  source: string,
  inputs: PersonInput[],
): Promise<ResolveResult> {
  const clean = inputs.map((p) => ({
    ...p,
    personId: p.personId?.trim() || undefined,
    emails: [...new Set(p.emails.map(normalizeEmail).filter(Boolean))],
  }));

  const byPlatform = await lookup(
    db,
    ctx.conferenceId,
    "platform_id",
    [...new Set(clean.flatMap((p) => (p.personId ? [p.personId] : [])))],
  );
  const byEmail = await lookup(db, ctx.conferenceId, "email", [
    ...new Set(clean.flatMap((p) => p.emails)),
  ]);
  const platformOf = await platformIdsOf(db, [...new Set(byEmail.values())]);

  // New persons get negative placeholder ids until they are inserted
  let nextPlaceholder = -1;
  const newPersons: { placeholder: number; name?: string; institution?: string }[] = [];
  const newIdentifiers: { person: number; kind: "platform_id" | "email"; value: string }[] = [];
  const conflicts: { kind: "email"; value: string; existing: number; incoming: number }[] = [];
  const ids: number[] = [];

  for (const p of clean) {
    let person: number | undefined;
    if (p.personId && byPlatform.has(p.personId)) {
      person = byPlatform.get(p.personId);
    } else {
      const emailMatch = p.emails.map((e) => byEmail.get(e)).find((id) => id !== undefined);
      const otherId = emailMatch !== undefined ? platformOf.get(emailMatch) : undefined;
      if (emailMatch !== undefined && !(p.personId && otherId && otherId !== p.personId))
        person = emailMatch;
    }
    if (person === undefined) {
      person = nextPlaceholder--;
      newPersons.push({ placeholder: person, name: p.name, institution: p.institution });
    }

    if (p.personId && !byPlatform.has(p.personId)) {
      byPlatform.set(p.personId, person);
      platformOf.set(person, p.personId);
      newIdentifiers.push({ person, kind: "platform_id", value: p.personId });
    }
    for (const email of p.emails) {
      const owner = byEmail.get(email);
      if (owner === undefined) {
        byEmail.set(email, person);
        newIdentifiers.push({ person, kind: "email", value: email });
      } else if (owner !== person) {
        conflicts.push({ kind: "email", value: email, existing: owner, incoming: person });
      }
    }
    ids.push(person);
  }

  // insert new persons one statement each, so every id is known
  const realId = new Map<number, number>();
  if (newPersons.length > 0) {
    const inserted = await db.batch(
      newPersons.map((p) =>
        db
          .insert(persons)
          .values({ conferenceId: ctx.conferenceId, name: p.name, institution: p.institution })
          .returning({ id: persons.id }),
      ) as [any, ...any[]],
    );
    newPersons.forEach((p, i) => realId.set(p.placeholder, (inserted[i] as { id: number }[])[0]!.id));
  }
  const real = (id: number) => (id < 0 ? realId.get(id)! : id);
  const finalIds = ids.map(real);

  for (const part of chunkRows(newIdentifiers, 4))
    await db
      .insert(personIdentifiers)
      .values(
        part.map((i) => ({
          conferenceId: ctx.conferenceId,
          personId: real(i.person),
          kind: i.kind,
          value: i.value,
        })),
      )
      .onConflictDoNothing();

  for (const part of chunkRows(conflicts, 6))
    await db.insert(importConflicts).values(
      part.map((c) => ({
        conferenceId: ctx.conferenceId,
        importJobId: ctx.importJobId,
        kind: c.kind,
        value: c.value,
        existingPersonId: real(c.existing),
        incomingPersonId: real(c.incoming),
      })),
    ).onConflictDoNothing();

  // the person as seen in this edition (latest import wins)
  const seen = new Map<number, { name?: string; institution?: string }>();
  clean.forEach((p, i) => {
    const prev = seen.get(finalIds[i]!) ?? {};
    seen.set(finalIds[i]!, {
      name: p.name || prev.name,
      institution: p.institution || prev.institution,
    });
  });
  for (const part of chunkRows([...seen], 5))
    await db
      .insert(editionPersons)
      .values(
        part.map(([personId, p]) => ({
          editionId: ctx.editionId,
          personId,
          name: p.name,
          institution: p.institution,
          source,
        })),
      )
      .onConflictDoUpdate({
        target: [editionPersons.editionId, editionPersons.personId],
        set: {
          name: sql`coalesce(excluded.name, ${editionPersons.name})`,
          institution: sql`coalesce(excluded.institution, ${editionPersons.institution})`,
        },
      });

  return { ids: finalIds, created: newPersons.length, conflicts: conflicts.length };
}
