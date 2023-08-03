import { NextResponse } from "next/server";

// simply make project endpoint:
// - verify token
// - if verified, return all submissions and user submissions

// token should just be a 32bit or so string, not a jwt
// should be a projectuser table to match token,
// that joins with a userSubmissions table
// that joins with the submissions

// On the bidding page, have a sidebar with reference submissions, which
// are all users own submissions. They can disable them, and
// also select other submissions as additional reference submissions.

export async function GET(req: Request) {
  console.log(req.headers);

  // db query for token > usersubmissions > submissions
  // if no match, invalid token
  // if match, db query for all project submissions
  // return only the submission ids with vectors to keep small
  // then on page compute strongest matches and retrieve
  // abstracts with pagination

  return NextResponse.json({ test: "test" });
}

export async function POST(req: Request) {
  return NextResponse.json({ status: 201 });
}
