"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { FormField } from "./FormField";
import {
  maskTelegramPhone,
  normalizeTelegramPhone,
  telegramErrorMessage,
} from "../services/telegram";
import type { TelegramChallenge, TelegramService } from "../services/telegram";

type WizardView = "intro" | "phone" | "code" | "password" | "success";

const CODE_PATTERN = /^\d{4,12}$/;

export function TelegramWizard({
  service,
  onClose,
  onConnected,
}: {
  service: TelegramService;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [view, setView] = useState<WizardView>("intro");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [phoneMask, setPhoneMask] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const version = useRef(0);

  const close = useCallback(() => {
    version.current++;
    onClose();
  }, [onClose]);

  const restart = useCallback((next: WizardView) => {
    setView(next);
    setChallengeId(null);
    setExpiresAt(null);
    setError(null);
    setNotice(null);
    setBusy(false);
  }, []);

  useEffect(() => {
    restoreFocus.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      version.current++;
      document.body.style.overflow = previousOverflow;
      restoreFocus.current?.focus();
    };
  }, []);

  useEffect(() => {
    if (error) errorBox.current?.focus();
  }, [error]);

  useEffect(() => {
    if (view === "success") onConnected();
  }, [view, onConnected]);

  useEffect(() => {
    if (!expiresAt || (view !== "code" && view !== "password")) return;
    const delay = Date.parse(expiresAt) - Date.now();
    if (Number.isNaN(delay)) return;
    if (delay <= 0) {
      restart("phone");
      setError(
        "This connection attempt expired. Start again with your phone number.",
      );
      return;
    }
    const timer = setTimeout(() => {
      restart("phone");
      setError(
        "This connection attempt expired. Start again with your phone number.",
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [expiresAt, view, restart]);

  function applyChallenge(challenge: TelegramChallenge) {
    setChallengeId(challenge.challengeId);
    setExpiresAt(challenge.expiresAt);
  }

  function failChallenge(challenge: TelegramChallenge) {
    restart("phone");
    setError(
      challenge.status === "expired"
        ? "This connection attempt expired. Start again with your phone number."
        : "Telegram couldn’t complete this connection attempt. Start again with your phone number.",
    );
  }

  async function submitPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const raw = String(new FormData(event.currentTarget).get("phone") ?? "");
    const normalized = normalizeTelegramPhone(raw);
    if (!normalized) {
      setError(
        "Enter an international phone number with your country code, e.g. +44 7700 900123.",
      );
      return;
    }
    const request = version.current;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const challenge = await service.startConnection({
        phoneNumber: normalized,
      });
      if (request !== version.current) return;
      setPhoneNumber(normalized);
      setPhoneMask(maskTelegramPhone(normalized));
      applyChallenge(challenge);
      if (challenge.status === "complete") setView("success");
      else setView("code");
    } catch (err) {
      if (request !== version.current) return;
      setError(telegramErrorMessage(err));
    } finally {
      if (request === version.current) setBusy(false);
    }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !challengeId) return;
    const form = event.currentTarget;
    const code = String(new FormData(form).get("code") ?? "")
      .trim()
      .replace(/\s+/g, "");
    if (!CODE_PATTERN.test(code)) {
      setError("Enter the numeric code Telegram sent you (4–12 digits).");
      return;
    }
    const request = version.current;
    form.reset();
    setError(null);
    setBusy(true);
    try {
      const challenge = await service.verifyCode(challengeId, code);
      if (request !== version.current) return;
      applyChallenge(challenge);
      if (challenge.status === "complete") setView("success");
      else if (challenge.status === "password_required") setView("password");
      else failChallenge(challenge);
    } catch (err) {
      if (request !== version.current) return;
      setError(telegramErrorMessage(err));
    } finally {
      if (request === version.current) setBusy(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !challengeId) return;
    const form = event.currentTarget;
    const password = String(new FormData(form).get("password") ?? "");
    if (!password) {
      setError("Enter your Telegram two-step verification password.");
      return;
    }
    const request = version.current;
    form.reset();
    setError(null);
    setBusy(true);
    try {
      const challenge = await service.verifyPassword(challengeId, password);
      if (request !== version.current) return;
      applyChallenge(challenge);
      if (challenge.status === "complete") setView("success");
      else failChallenge(challenge);
    } catch (err) {
      if (request !== version.current) return;
      setError(telegramErrorMessage(err));
    } finally {
      if (request === version.current) setBusy(false);
    }
  }

  async function resendCode() {
    if (busy || !phoneNumber) return;
    const request = version.current;
    setError(null);
    setBusy(true);
    try {
      const challenge = await service.startConnection({
        phoneNumber,
      });
      if (request !== version.current) return;
      applyChallenge(challenge);
      if (challenge.status === "complete") setView("success");
      else {
        setView("code");
        setNotice("A new login code was sent.");
      }
    } catch (err) {
      if (request !== version.current) return;
      setError(telegramErrorMessage(err));
    } finally {
      if (request === version.current) setBusy(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const root = dialogRef.current;
    if (!root) return;
    const focusable = [
      ...root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((element) => !element.hasAttribute("disabled"));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === root)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const titles: Record<WizardView, string> = {
    intro: "Connect a Telegram account",
    phone: "What’s your Telegram number?",
    code: "Enter your code",
    password: "Two-step verification",
    success: "Account connected",
  };

  return (
    <div className="wizard-overlay">
      <div
        className="wizard-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="telegram-wizard-title"
        tabIndex={-1}
        ref={dialogRef}
        onKeyDown={handleKeyDown}
      >
        <div className="wizard-head">
          <span className="eyebrow">TELEGRAM CONNECTION</span>
          <button
            type="button"
            className="wizard-close"
            aria-label="Close connection wizard"
            onClick={close}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <h2 id="telegram-wizard-title">{titles[view]}</h2>
        {notice && (
          <p role="status" className="form-notice">
            {notice}
          </p>
        )}
        {error && (
          <div className="form-alert" role="alert" tabIndex={-1} ref={errorBox}>
            <span>{error}</span>
          </div>
        )}

        {view === "intro" && (
          <div className="wizard-body">
            <p>
              Link a Telegram account to your workspace. Telegram will send you
              a login code — usually inside the Telegram app, sometimes by SMS.
            </p>
            <div className="wizard-note">
              <b>Privacy note</b>
              <span>
                To keep the account connected, the platform’s backend maintains
                an authorized Telegram session. Your login code and two-step
                verification password are sent only to the secure backend over
                HTTPS and are never stored in this browser.
              </span>
            </div>
            <button
              type="button"
              className="button button-primary wizard-submit"
              onClick={() => restart("phone")}
            >
              Connect Telegram
            </button>
          </div>
        )}

        {view === "phone" && (
          <form onSubmit={submitPhone} noValidate aria-busy={busy}>
            <div className="wizard-body">
              <p>
                Enter the phone number of the Telegram account you want to
                connect. Include your country code.
              </p>
              <FormField
                label="Telegram phone number"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+44 7700 900123"
                hint="Include your country code, e.g. +44 7700 900123."
                required
                autoFocus
              />
              <button
                type="submit"
                className="button button-primary wizard-submit"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <span className="spinner" />
                    Sending code…
                  </>
                ) : (
                  "Send code"
                )}
              </button>
            </div>
          </form>
        )}

        {view === "code" && (
          <form onSubmit={submitCode} noValidate aria-busy={busy}>
            <div className="wizard-body">
              <p>
                Enter the code Telegram sent you
                {phoneMask ? ` to the account ending ${phoneMask}` : ""}. It
                usually arrives in the Telegram app.
              </p>
              <FormField
                label="Verification code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={12}
                required
                autoFocus
              />
              <button
                type="submit"
                className="button button-primary wizard-submit"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <span className="spinner" />
                    Verifying…
                  </>
                ) : (
                  "Verify code"
                )}
              </button>
              <div className="wizard-alt-actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => void resendCode()}
                  disabled={busy}
                >
                  Resend code
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => restart("phone")}
                >
                  Use a different number
                </button>
              </div>
            </div>
          </form>
        )}

        {view === "password" && (
          <form onSubmit={submitPassword} noValidate aria-busy={busy}>
            <div className="wizard-body">
              <p>
                Telegram protects this account with two-step verification. Enter
                your Telegram cloud password to finish connecting.
              </p>
              <div className="wizard-note">
                <b>This is not your Prime Edge password</b>
                <span>
                  It is the two-step verification password you set inside
                  Telegram. It is sent only to the secure backend and is never
                  stored in this browser.
                </span>
              </div>
              <FormField
                label="Telegram two-step verification password"
                name="password"
                type="password"
                autoComplete="off"
                required
                autoFocus
              />
              <button
                type="submit"
                className="button button-primary wizard-submit"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <span className="spinner" />
                    Verifying…
                  </>
                ) : (
                  "Verify password"
                )}
              </button>
              <div className="wizard-alt-actions">
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => restart("phone")}
                >
                  Start over
                </button>
              </div>
            </div>
          </form>
        )}

        {view === "success" && (
          <div className="wizard-body">
            <p>Your Telegram account is now connected.</p>
            <div className="wizard-alt-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => restart("intro")}
              >
                Connect another
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={close}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
