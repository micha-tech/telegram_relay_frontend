"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { FormField } from "./FormField";
import {
  TelegramApiError,
  maskTelegramPhone,
  normalizeTelegramPhone,
  telegramErrorMessage,
} from "../services/telegram";
import type {
  TelegramAuthStep,
  TelegramConnection,
  TelegramService,
} from "../services/telegram";

type WizardView =
  "intro" | "phone" | "code" | "password" | "connecting" | "success";

export interface TelegramWizardInitial {
  connectionId: string;
  nextStep: TelegramAuthStep;
  expiresAt?: string | null;
  retryAfterSeconds?: number | null;
  phoneMask?: string | null;
}

interface WizardState {
  view: WizardView;
  connectionId: string | null;
  phoneMask: string | null;
  expiresAt: string | null;
  retryAfterSeconds: number | null;
  error: string | null;
  notice: string | null;
  busy: boolean;
  success: { displayName: string | null; username: string | null } | null;
}

type Action =
  | { type: "busy"; busy: boolean }
  | { type: "error"; message: string }
  | { type: "clear-error" }
  | { type: "notice"; message: string | null }
  | { type: "connection"; connection: TelegramConnection; phoneMask?: string }
  | { type: "expired" }
  | { type: "restart"; view: WizardView }
  | { type: "success"; displayName: string | null; username: string | null };

function viewForStep(step: TelegramAuthStep): WizardView | null {
  switch (step) {
    case "phone":
      return "phone";
    case "code":
      return "code";
    case "password":
      return "password";
    case "connecting":
      return "connecting";
    case "completed":
      return "success";
    default:
      return null;
  }
}

function initialState(initial?: TelegramWizardInitial | null): WizardState {
  const base: WizardState = {
    view: "intro",
    connectionId: null,
    phoneMask: null,
    expiresAt: null,
    retryAfterSeconds: null,
    error: null,
    notice: null,
    busy: false,
    success: null,
  };
  if (!initial) return base;
  const view = viewForStep(initial.nextStep);
  if (!view)
    return {
      ...base,
      error:
        "This connection attempt can’t be resumed. Start again with your phone number.",
    };
  return {
    ...base,
    view,
    connectionId: initial.connectionId,
    phoneMask: initial.phoneMask ?? null,
    expiresAt: initial.expiresAt ?? null,
    retryAfterSeconds: initial.retryAfterSeconds ?? null,
  };
}

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case "busy":
      return { ...state, busy: action.busy };
    case "error":
      return { ...state, error: action.message, busy: false, notice: null };
    case "clear-error":
      return { ...state, error: null };
    case "notice":
      return { ...state, notice: action.message, error: null };
    case "restart":
      return {
        ...state,
        view: action.view,
        connectionId: null,
        expiresAt: null,
        retryAfterSeconds: null,
        error: null,
        notice: null,
        busy: false,
        success: null,
      };
    case "expired":
      return {
        ...state,
        view: "phone",
        connectionId: null,
        expiresAt: null,
        retryAfterSeconds: null,
        busy: false,
        success: null,
        error:
          "This connection attempt expired. Start again with your phone number.",
      };
    case "success":
      return {
        ...state,
        view: "success",
        busy: false,
        error: null,
        notice: null,
        success: {
          displayName: action.displayName,
          username: action.username,
        },
      };
    case "connection": {
      const { connection } = action;
      const phoneMask = action.phoneMask ?? state.phoneMask;
      if (connection.nextStep === "expired")
        return {
          ...state,
          view: "phone",
          connectionId: null,
          expiresAt: null,
          retryAfterSeconds: null,
          busy: false,
          success: null,
          error:
            connection.message ??
            "This connection attempt expired. Start again with your phone number.",
        };
      if (connection.nextStep === "failed")
        return {
          ...state,
          view: "phone",
          connectionId: null,
          expiresAt: null,
          retryAfterSeconds: null,
          busy: false,
          success: null,
          error:
            connection.message ??
            "Telegram couldn’t complete this connection attempt. Start again with your phone number.",
        };
      if (connection.nextStep === "completed")
        return {
          ...state,
          view: "success",
          busy: false,
          error: null,
          notice: null,
          phoneMask,
          connectionId: connection.connectionId,
          success: {
            displayName: connection.account?.displayName ?? null,
            username: connection.account?.username ?? null,
          },
        };
      const view = viewForStep(connection.nextStep);
      if (!view) return state;
      if (view === "connecting" && state.view === "connecting")
        return {
          ...state,
          phoneMask,
          expiresAt: connection.expiresAt,
          retryAfterSeconds: connection.retryAfterSeconds ?? null,
        };
      return {
        ...state,
        view,
        connectionId: connection.connectionId,
        phoneMask,
        expiresAt: connection.expiresAt,
        retryAfterSeconds: connection.retryAfterSeconds ?? null,
        busy: false,
        error: null,
        success: null,
      };
    }
    default:
      return state;
  }
}

export function TelegramWizard({
  service,
  initial,
  onClose,
  onConnected,
}: {
  service: TelegramService;
  initial?: TelegramWizardInitial | null;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [state, dispatch] = useReducer(reducer, initial, initialState);
  const [countdown, setCountdown] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const version = useRef(0);

  const close = useCallback(() => {
    version.current++;
    onClose();
  }, [onClose]);

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
    if (state.error) errorBox.current?.focus();
  }, [state.error]);

  useEffect(() => {
    if (state.view === "success") onConnected();
  }, [state.view, onConnected]);

  useEffect(() => {
    const seconds = state.retryAfterSeconds ?? 0;
    if (seconds <= 0 || state.view !== "code") {
      setCountdown(0);
      return;
    }
    setCountdown(seconds);
    const timer = setInterval(
      () => setCountdown((value) => (value <= 1 ? 0 : value - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [state.retryAfterSeconds, state.view]);

  useEffect(() => {
    if (
      !state.expiresAt ||
      (state.view !== "code" && state.view !== "password")
    )
      return;
    const delay = Date.parse(state.expiresAt) - Date.now();
    if (Number.isNaN(delay)) return;
    if (delay <= 0) {
      dispatch({ type: "expired" });
      return;
    }
    const timer = setTimeout(() => dispatch({ type: "expired" }), delay);
    return () => clearTimeout(timer);
  }, [state.expiresAt, state.view]);

  const checkStatus = useCallback(async () => {
    const connectionId = state.connectionId;
    if (!connectionId) return;
    const request = version.current;
    try {
      const connection = await service.getConnection(connectionId);
      if (request !== version.current) return;
      dispatch({ type: "connection", connection });
    } catch (err) {
      if (request !== version.current) return;
      dispatch({ type: "error", message: telegramErrorMessage(err) });
    }
  }, [service, state.connectionId]);

  useEffect(() => {
    if (state.view !== "connecting" || !state.connectionId) return;
    let cancelled = false;
    let attempts = 0;
    const connectionId = state.connectionId;
    const poll = async () => {
      if (cancelled || attempts >= 12) return;
      attempts += 1;
      try {
        const connection = await service.getConnection(connectionId);
        if (cancelled) return;
        dispatch({ type: "connection", connection });
      } catch {
        if (cancelled) return;
        if (attempts >= 12)
          dispatch({
            type: "error",
            message:
              "We couldn’t confirm the connection. Check the status before trying again.",
          });
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [state.view, state.connectionId, service]);

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

  async function recoverFromTimeout(request: number) {
    const connectionId = state.connectionId;
    if (connectionId) {
      try {
        const connection = await service.getConnection(connectionId);
        if (request !== version.current) return;
        dispatch({ type: "connection", connection });
        return;
      } catch {
        if (request !== version.current) return;
      }
    }
    dispatch({
      type: "error",
      message:
        "We couldn’t confirm the result. Check the connection status before trying again.",
    });
  }

  async function submitPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.busy) return;
    const raw = String(new FormData(event.currentTarget).get("phone") ?? "");
    const phoneNumber = normalizeTelegramPhone(raw);
    if (!phoneNumber) {
      dispatch({
        type: "error",
        message:
          "Enter an international phone number with your country code, e.g. +44 7700 900123.",
      });
      return;
    }
    const request = version.current;
    dispatch({ type: "clear-error" });
    dispatch({ type: "busy", busy: true });
    try {
      const connection = await service.startConnection({ phoneNumber });
      if (request !== version.current) return;
      dispatch({
        type: "connection",
        connection,
        phoneMask: maskTelegramPhone(phoneNumber),
      });
    } catch (err) {
      if (request !== version.current) return;
      if (err instanceof TelegramApiError && err.code === "timeout") {
        await recoverFromTimeout(request);
        return;
      }
      dispatch({ type: "error", message: telegramErrorMessage(err) });
    } finally {
      if (request === version.current) dispatch({ type: "busy", busy: false });
    }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.busy || !state.connectionId) return;
    const form = event.currentTarget;
    const code = String(new FormData(form).get("code") ?? "")
      .trim()
      .replace(/\s+/g, "");
    if (!code) {
      dispatch({
        type: "error",
        message: "Enter the code Telegram sent you.",
      });
      return;
    }
    const connectionId = state.connectionId;
    const request = version.current;
    form.reset();
    dispatch({ type: "clear-error" });
    dispatch({ type: "busy", busy: true });
    try {
      const connection = await service.verifyCode(connectionId, code);
      if (request !== version.current) return;
      dispatch({ type: "connection", connection });
    } catch (err) {
      if (request !== version.current) return;
      if (err instanceof TelegramApiError && err.code === "timeout") {
        await recoverFromTimeout(request);
        return;
      }
      dispatch({ type: "error", message: telegramErrorMessage(err) });
    } finally {
      if (request === version.current) dispatch({ type: "busy", busy: false });
    }
  }

  async function resendCode() {
    if (state.busy || countdown > 0 || !state.connectionId) return;
    const connectionId = state.connectionId;
    const request = version.current;
    dispatch({ type: "clear-error" });
    dispatch({ type: "busy", busy: true });
    try {
      const connection = await service.sendCode(connectionId);
      if (request !== version.current) return;
      dispatch({
        type: "connection",
        connection,
      });
      dispatch({
        type: "notice",
        message: connection.message ?? "A new login code was sent.",
      });
    } catch (err) {
      if (request !== version.current) return;
      dispatch({ type: "error", message: telegramErrorMessage(err) });
    } finally {
      if (request === version.current) dispatch({ type: "busy", busy: false });
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.busy || !state.connectionId) return;
    const form = event.currentTarget;
    const password = String(new FormData(form).get("password") ?? "");
    if (!password) {
      dispatch({
        type: "error",
        message: "Enter your Telegram two-step verification password.",
      });
      return;
    }
    const connectionId = state.connectionId;
    const request = version.current;
    form.reset();
    dispatch({ type: "clear-error" });
    dispatch({ type: "busy", busy: true });
    try {
      const connection = await service.verifyPassword(connectionId, password);
      if (request !== version.current) return;
      dispatch({ type: "connection", connection });
    } catch (err) {
      if (request !== version.current) return;
      if (err instanceof TelegramApiError && err.code === "timeout") {
        await recoverFromTimeout(request);
        return;
      }
      dispatch({ type: "error", message: telegramErrorMessage(err) });
    } finally {
      if (request === version.current) dispatch({ type: "busy", busy: false });
    }
  }

  const titles: Record<WizardView, string> = {
    intro: "Connect a Telegram account",
    phone: "What’s your Telegram number?",
    code: "Enter your code",
    password: "Two-step verification",
    connecting: "Finishing connection…",
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
        <h2 id="telegram-wizard-title">{titles[state.view]}</h2>
        {state.notice && (
          <p role="status" className="form-notice">
            {state.notice}
          </p>
        )}
        {state.error && (
          <div className="form-alert" role="alert" tabIndex={-1} ref={errorBox}>
            <span>{state.error}</span>
          </div>
        )}

        {state.view === "intro" && (
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
              onClick={() => {
                dispatch({ type: "clear-error" });
                dispatch({ type: "restart", view: "phone" });
              }}
            >
              Connect Telegram
            </button>
          </div>
        )}

        {state.view === "phone" && (
          <form onSubmit={submitPhone} noValidate aria-busy={state.busy}>
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
                disabled={state.busy}
              >
                {state.busy ? (
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

        {state.view === "code" && (
          <form onSubmit={submitCode} noValidate aria-busy={state.busy}>
            <div className="wizard-body">
              <p>
                Enter the code Telegram sent you
                {state.phoneMask
                  ? ` to the account ending ${state.phoneMask}`
                  : ""}
                . It usually arrives in the Telegram app.
              </p>
              <FormField
                label="Verification code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                required
                autoFocus
              />
              <button
                type="submit"
                className="button button-primary wizard-submit"
                disabled={state.busy}
              >
                {state.busy ? (
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
                  disabled={state.busy || countdown > 0}
                >
                  {countdown > 0
                    ? `Resend code in ${countdown}s`
                    : "Resend code"}
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={state.busy}
                  onClick={() => dispatch({ type: "restart", view: "phone" })}
                >
                  Use a different number
                </button>
              </div>
            </div>
          </form>
        )}

        {state.view === "password" && (
          <form onSubmit={submitPassword} noValidate aria-busy={state.busy}>
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
                disabled={state.busy}
              >
                {state.busy ? (
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
                  disabled={state.busy}
                  onClick={() => dispatch({ type: "restart", view: "phone" })}
                >
                  Start over
                </button>
              </div>
            </div>
          </form>
        )}

        {state.view === "connecting" && (
          <div className="wizard-body wizard-progress">
            <span className="spinner spinner-lg" aria-hidden="true" />
            <p role="status">
              Telegram is confirming the account. This usually takes a few
              seconds.
            </p>
            <button
              type="button"
              className="button button-secondary wizard-submit"
              onClick={() => void checkStatus()}
            >
              Check status
            </button>
            <button type="button" className="text-button" onClick={close}>
              Cancel
            </button>
          </div>
        )}

        {state.view === "success" && (
          <div className="wizard-body">
            <p>
              {state.success?.displayName || state.success?.username
                ? `${
                    state.success.displayName ?? state.success.username
                  } is connected.`
                : "Your Telegram account is now connected."}
            </p>
            {state.success?.username && (
              <p className="wizard-handle">@{state.success.username}</p>
            )}
            <div className="wizard-alt-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => dispatch({ type: "restart", view: "intro" })}
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
