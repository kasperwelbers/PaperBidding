import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router";
import { api } from "./api";
import { authClient } from "./auth";
import Admins from "./pages/Admins";
import Conference from "./pages/Conference";
import Edition from "./pages/Edition";
import Home from "./pages/Home";
import SignIn from "./pages/SignIn";
import { Button } from "./ui";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } },
});

export type Me = { email: string; isSuperadmin: boolean; isAdmin: boolean };

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function Shell() {
  const queryClient = useQueryClient();
  // null = not signed in
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me | null> => {
      const res = await api.me.$get();
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Could not reach the server");
      return (await res.json()) as Me;
    },
  });

  if (me.isLoading) return null;
  if (me.error) return <p className="p-8 text-red-700">{me.error.message}</p>;
  if (!me.data) return <SignIn onSignedIn={() => queryClient.invalidateQueries()} />;

  async function signOut() {
    await authClient.signOut();
    queryClient.clear();
    await queryClient.invalidateQueries({ queryKey: ["me"] });
  }

  return (
    <div>
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-4xl items-center justify-between p-3">
          <Link to="/" className="font-bold">
            Conference planner
          </Link>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            {me.data.email}
            <Button variant="ghost" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-6">
        <Routes>
          <Route path="/" element={<Home me={me.data} />} />
          <Route
            path="/admins"
            element={me.data.isSuperadmin ? <Admins /> : <Navigate to="/" replace />}
          />
          <Route path="/conferences/:conferenceId" element={<Conference />} />
          <Route path="/conferences/:conferenceId/editions/:editionId" element={<Edition />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
