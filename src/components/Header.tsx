"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Arrow, Brand, ButtonLink } from "./ui";

export function Header() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        setOpen(false);
        toggle.current?.focus();
      }
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#platform">The platform</a>
          <a href="#soccertradeview">SoccerTradeView</a>
          <a href="#how-it-works">How it works</a>
          <a href="#membership">Membership</a>
        </nav>
        <div className="header-actions">
          <Link href="/login" className="text-link">
            Sign In
          </Link>
          <ButtonLink>Get Started</ButtonLink>
        </div>
        <button
          ref={toggle}
          className="menu-toggle"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <span>✕</span>
          ) : (
            <>
              <span />
              <span />
            </>
          )}
        </button>
      </div>
      {open && (
        <nav
          className="mobile-nav"
          id="mobile-navigation"
          aria-label="Mobile navigation"
        >
          {[
            ["The platform", "#platform"],
            ["SoccerTradeView", "#soccertradeview"],
            ["How it works", "#how-it-works"],
            ["Membership", "#membership"],
          ].map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {label}
              <Arrow />
            </a>
          ))}
          <Link href="/login">Sign In</Link>
          <ButtonLink>Get Started</ButtonLink>
        </nav>
      )}
    </header>
  );
}
