import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/raise/supabase";

export function useAuth() {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      setUserId(data.session?.user.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return { email, userId, configured: supabase != null };
}

export function AuthPanel() {
  const { email, configured } = useAuth();
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  if (!configured) {
    return (
      <p className="text-sm text-muted-foreground">
        Sign-in starts after Supabase is linked. The directory, match, and news already run on the
        bundled dataset.
      </p>
    );
  }

  if (email) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>Signed in as {email}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void supabase?.auth.signOut();
          }}
        >
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        void supabase?.auth.signInWithPassword({ email: address, password }).then(({ error }) => {
          setMessage(error ? error.message : null);
        });
      }}
    >
      <div className="grid gap-1">
        <Label htmlFor="auth-email">Email</Label>
        <Input
          id="auth-email"
          type="email"
          autoComplete="email"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          required
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="auth-password">Password</Label>
        <Input
          id="auth-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit">Sign in</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setMessage(null);
            void supabase?.auth.signUp({ email: address, password }).then(({ error }) => {
              setMessage(error ? error.message : "Account created. Check your email if confirmation is on.");
            });
          }}
        >
          Create account
        </Button>
      </div>
      {message ? <p className="text-sm text-muted-foreground sm:col-span-3">{message}</p> : null}
    </form>
  );
}
