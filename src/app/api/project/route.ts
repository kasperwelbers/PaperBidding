import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function GET(req: Request) {
  const headersList = headers();
  console.log(headersList.get("Authorization"));
  return NextResponse.json({ projects: demo_projects });
}

export async function POST(req: Request) {
  const { name } = await req.json();
  const project = {
    id: demo_projects.length,
    name,
    secret: String(demo_projects.length + 1),
  };
  return NextResponse.json({ status: 200 });
}

var demo_projects = [
  { id: 0, name: "test1", secret: "1" },
  { id: 1, name: "test2", secret: "2" },
  { id: 2, name: "test3", secret: "3" },
  { id: 3, name: "test4", secret: "4" },
  { id: 4, name: "test5", secret: "5" },
];
