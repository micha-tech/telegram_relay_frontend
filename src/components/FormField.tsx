"use client";

import { useState } from "react";
import type { InputHTMLAttributes } from "react";
interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  name: string;
}
export function FormField({
  label,
  error,
  hint,
  name,
  type = "text",
  ...props
}: Props) {
  const [visible, setVisible] = useState(false);
  const password = type === "password";
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <div className={`input-wrap ${error ? "input-invalid" : ""}`}>
        <input
          {...props}
          name={name}
          id={name}
          type={password && visible ? "text" : type}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${name}-error` : hint ? `${name}-hint` : undefined
          }
        />
        {password && (
          <button
            type="button"
            className="password-toggle"
            aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            <svg
              viewBox="0 0 24 24"
              width="19"
              height="19"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle
                cx="12"
                cy="12"
                r="2.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              {visible && (
                <path d="m3 3 18 18" stroke="currentColor" strokeWidth="1.5" />
              )}
            </svg>
          </button>
        )}
      </div>
      {error ? (
        <p className="field-error" id={`${name}-error`}>
          {error}
        </p>
      ) : (
        hint && (
          <p className="field-hint" id={`${name}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}
