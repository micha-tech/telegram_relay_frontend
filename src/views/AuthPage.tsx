"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Arrow, Brand, Eyebrow } from "../components/ui";
import { FormField } from "../components/FormField";
import { AuthError, authErrorMessage } from "../services/auth";
import { useSession } from "../services/session";
import { safeRedirect } from "../services/redirect";

export function AuthPage({
  mode,
  redirectTo,
}: {
  mode: "signup" | "login";
  redirectTo?: string;
}) {
  const signup = mode === "signup";
  const {
    user,
    loading,
    error: sessionError,
    setUser,
    refresh,
    service,
  } = useSession();
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [verification, setVerification] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const requestVersion = useRef(0);
  const redirect = safeRedirect(redirectTo);
  const alternateRoute = `${signup ? "/login" : "/signup"}${redirect === "/dashboard" ? "" : `?next=${encodeURIComponent(redirect)}`}`;
  useEffect(() => {
    requestVersion.current++;
    setErrors({});
    setError("");
    setBusy(false);
    setVerification(false);
    form.current?.reset();
    return () => {
      requestVersion.current++;
    };
  }, [mode]);
  useEffect(() => {
    if (error) errorBox.current?.focus();
  }, [error]);
  useEffect(() => {
    if (user) router.replace(redirect);
  }, [user, router, redirect]);
  if (user)
    return (
      <main className="state-page" role="status">
        Opening your workspace…
      </main>
    );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const values = new FormData(event.currentTarget);
    const name = String(values.get("name") ?? "").trim();
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    const confirmation = String(values.get("confirm-password") ?? "");
    const next: Record<string, string> = {};
    if (signup && name.length < 2) next.name = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    else if (signup && password.length < 8)
      next.password = "Use at least 8 characters.";
    if (signup && confirmation !== password)
      next["confirm-password"] = "Your passwords don’t match.";
    setErrors(next);
    if (Object.keys(next).length) {
      form.current
        ?.querySelector<HTMLInputElement>(`[name="${Object.keys(next)[0]}"]`)
        ?.focus();
      return;
    }
    const version = requestVersion.current;
    setBusy(true);
    try {
      if (signup) {
        const result = await service.register({ name, email, password });
        if (version !== requestVersion.current) return;
        if (result.status === "verification-required") {
          form.current?.reset();
          setVerification(true);
          return;
        }
        setUser(result.user);
      } else {
        const account = await service.login({ email, password });
        if (version !== requestVersion.current) return;
        setUser(account);
      }
      router.replace(redirect);
    } catch (err) {
      if (version !== requestVersion.current) return;
      setError(authErrorMessage(err));
      if (err instanceof AuthError && err.fieldErrors)
        setErrors(err.fieldErrors);
    } finally {
      if (version === requestVersion.current) setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Brand light />
        <div className="auth-story-content">
          <Eyebrow light>THE GAME. THE MARKET. YOUR EDGE.</Eyebrow>
          <h2>
            A clearer view.
            <br />A more considered
            <br />
            <span>approach.</span>
          </h2>
          <p>
            Make match context and market movement
            <br />
            part of the same conversation.
          </p>
          <div className="auth-artwork">
            <Image
              src="/football-artwork.png"
              alt="Illustrated footballer beside a mobile football match interface"
              width={2048}
              height={1536}
              sizes="(max-width: 740px) 1px, 50vw"
            />
          </div>
          <div className="auth-story-note">
            Built for the way you read the game.
          </div>
        </div>
        <div className="auth-story-footer">
          <span>PRIME EDGE FOOTBALL</span>
          <span>FOOTBALL. IN PERSPECTIVE.</span>
        </div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-topbar">
          <Link href="/" className="auth-back">
            <span>←</span> Back to home
          </Link>
          <span>
            {signup ? "Already a member?" : "New to Prime Edge?"}{" "}
            <Link href={alternateRoute}>
              {signup ? "Sign In" : "Get Started"} <Arrow diagonal />
            </Link>
          </span>
        </div>
        <div className="auth-form-content">
          <span className="auth-form-index">
            {signup ? "YOUR EDGE STARTS HERE" : "BACK TO THE GAME"}
          </span>
          <h1>{signup ? "Create your account" : "Welcome back"}</h1>
          <p className="auth-form-description">
            {signup
              ? "A more complete football perspective starts with you."
              : "Sign in to your Prime Edge Football workspace."}
          </p>
          {loading && (
            <div role="status" className="form-notice">
              Checking your session…
            </div>
          )}
          {sessionError && (
            <div className="form-alert" role="alert">
              {sessionError}
              <button type="button" onClick={() => void refresh()}>
                Retry connection
              </button>
            </div>
          )}
          {verification ? (
            <div role="status" className="verification-message">
              <span className="verification-icon" aria-hidden="true">
                ↗
              </span>
              <h3>Check your email</h3>
              <p>
                Your account request was received. Follow the verification
                instructions in your inbox to continue.
              </p>
              <Link href="/login" className="button button-primary">
                Back to Sign In <Arrow />
              </Link>
            </div>
          ) : (
            <form ref={form} onSubmit={submit} noValidate aria-busy={busy}>
              {error && (
                <div
                  className="form-alert"
                  role="alert"
                  tabIndex={-1}
                  ref={errorBox}
                >
                  <b>
                    We couldn’t {signup ? "create your account" : "sign you in"}
                    .
                  </b>
                  <span>{error}</span>
                </div>
              )}
              <fieldset disabled={busy || loading || !!sessionError}>
                {signup && (
                  <FormField
                    label="Full name"
                    name="name"
                    placeholder="Your full name"
                    autoComplete="name"
                    required
                    maxLength={120}
                    error={errors.name}
                  />
                )}
                <FormField
                  label="Email address"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  maxLength={254}
                  error={errors.email}
                />
                <FormField
                  label="Password"
                  name="password"
                  type="password"
                  placeholder={
                    signup ? "Create a password" : "Enter your password"
                  }
                  autoComplete={signup ? "new-password" : "current-password"}
                  required
                  hint={signup ? "Use at least 8 characters." : undefined}
                  error={errors.password}
                />
                {signup && (
                  <FormField
                    label="Confirm password"
                    name="confirm-password"
                    type="password"
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    required
                    error={errors["confirm-password"]}
                  />
                )}
                <button
                  type="submit"
                  className="button button-primary auth-submit"
                  disabled={busy || loading}
                >
                  {busy ? (
                    <>
                      <span className="spinner" />
                      {signup ? "Creating your account…" : "Signing in…"}
                    </>
                  ) : (
                    <>
                      {signup ? "Create Account" : "Sign In"}
                      <Arrow />
                    </>
                  )}
                </button>
              </fieldset>
              <p className="auth-form-note">
                {signup
                  ? "Creating an account is the first step. You’ll review your subscription before making a payment."
                  : "Your matchday workspace, ready when you are."}
              </p>
            </form>
          )}
          <div className="auth-switch">
            {signup ? "Already have an account?" : "Don’t have an account?"}{" "}
            <Link href={alternateRoute}>
              {signup ? "Sign In" : "Create an account"} <Arrow diagonal />
            </Link>
          </div>
        </div>
        <div className="auth-panel-footer">
          <span>© {new Date().getFullYear()} Prime Edge Football</span>
          <span>CONTEXT BUILDS CONFIDENCE.</span>
        </div>
      </section>
    </main>
  );
}
