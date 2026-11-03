import db, { icaPersons } from "@/drizzle/schema";
import { authenticate, isAnyProjectAdmin } from "@/lib/authenticate";
import { IcaPersonsSchema } from "@/zodSchemas";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

const CHUNK_SIZE = 1000;

/** Add or update email -> ICA Person ID pairs. The list is global (shared by all
 *  projects), so any project admin can contribute to it */
export async function POST(req: Request) {
  const { email, canCreateProject } = await authenticate();
  if (!email)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });

  const allowed = canCreateProject || (await isAnyProjectAdmin(email));
  if (!allowed)
    return NextResponse.json({}, { statusText: "Not authorized", status: 403 });

  const { data } = await req.json();
  const validData = IcaPersonsSchema.safeParse(data);
  if (!validData.success)
    return NextResponse.json(validData.error, {
      statusText: "invalid payload",
      status: 400,
    });

  // normalize, drop empty rows, and de-duplicate (last one wins)
  const persons = new Map<string, string>();
  for (const row of validData.data) {
    const e = row.email.trim().toLowerCase();
    const personId = row.personId.trim();
    if (!e || !personId) continue;
    if (e.length > 256 || personId.length > 64) continue;
    persons.set(e, personId);
  }

  const values = [...persons].map(([email, personId]) => ({
    email,
    personId,
    updated: new Date(),
  }));

  for (let i = 0; i < values.length; i += CHUNK_SIZE) {
    await db
      .insert(icaPersons)
      .values(values.slice(i, i + CHUNK_SIZE))
      .onConflictDoUpdate({
        target: [icaPersons.email],
        set: {
          personId: sql`excluded.person_id`,
          updated: sql`excluded.updated`,
        },
      });
  }

  return NextResponse.json({ n: values.length }, { status: 201 });
}
