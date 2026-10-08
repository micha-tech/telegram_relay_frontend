"use client";

import { useId, useState } from "react";

type Market = "Arsenal" | "Draw" | "Chelsea";
const movements = [
  0, 0.025, 0.015, 0.045, 0.01, -0.015, -0.04, -0.03, -0.06, -0.085, -0.07,
  -0.105, -0.09, -0.065, -0.1, -0.115, -0.15, -0.135, -0.12, -0.17, -0.19,
  -0.18, -0.155, -0.195, -0.22, -0.2, -0.24, -0.265, -0.25, -0.28, -0.3, -0.275,
  -0.26, -0.29, -0.325, -0.31, -0.35, -0.33, -0.36, -0.38, -0.37, -0.345,
  -0.365, -0.395, -0.41, -0.39, -0.43, -0.42, -0.445, -0.46, -0.44, -0.48,
  -0.465, -0.49, -0.475, -0.5, -0.48, -0.51, -0.5, -0.52,
];
const marketData = {
  Arsenal: { base: 2.06, scale: 1, value: "1.54", change: "−0.52", line: 1.54 },
  Draw: { base: 3.3, scale: -1.1, value: "3.87", change: "+0.57", line: 3.872 },
  Chelsea: {
    base: 3.65,
    scale: -2.5,
    value: "4.95",
    change: "+1.30",
    line: 4.95,
  },
};
function OddsChart({ market, interval }: { market: Market; interval: number }) {
  const id = useId().replace(/:/g, "");
  const { base, scale, line } = marketData[market];
  const points = movements.map((n, i) => ({
    open: base + (movements[i - 1] ?? 0) * scale,
    close: base + n * scale,
  }));
  const buckets = Array.from(
    { length: Math.ceil(points.length / interval) },
    (_, i) => {
      const group = points.slice(i * interval, (i + 1) * interval);
      return {
        open: group[0].open,
        close: group[group.length - 1].close,
        high: Math.max(...group.flatMap((p) => [p.open, p.close])) + 0.024,
        low: Math.min(...group.flatMap((p) => [p.open, p.close])) - 0.024,
      };
    },
  );
  const min = Math.min(...buckets.map((p) => p.low)) - 0.06;
  const max = Math.max(...buckets.map((p) => p.high)) + 0.06;
  const y = (v: number) => 20 + ((max - v) / (max - min)) * 186;
  const step = 502 / buckets.length;
  return (
    <svg
      className="odds-chart"
      viewBox="0 0 580 256"
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
    >
      <title
        id={`${id}-title`}
      >{`${market} illustrative match odds, ${interval} minute candles`}</title>
      <desc id={`${id}-desc`}>
        Sample decimal odds for {market}, moving from {base.toFixed(2)} to{" "}
        {line.toFixed(2)}. This is a product demonstration, not a live match or
        trading recommendation.
      </desc>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <line
            x1="12"
            x2="526"
            y1={20 + i * 47}
            y2={20 + i * 47}
            stroke="#303a39"
            strokeDasharray="2 4"
          />
          <text
            x="539"
            y={24 + i * 47}
            fill="#82918d"
            fontSize="10"
            fontFamily="monospace"
          >
            {(max - ((max - min) * i) / 4).toFixed(2)}
          </text>
        </g>
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <line
            x1={20 + i * 100}
            x2={20 + i * 100}
            y1="20"
            y2="215"
            stroke="#283230"
          />
          <text
            x={16 + i * 100}
            y="241"
            fill="#82918d"
            fontSize="10"
            fontFamily="monospace"
          >
            {i * 12 + 4}′
          </text>
        </g>
      ))}
      {buckets.map((p, i) => {
        const color = p.close <= p.open ? "#80b99b" : "#cf7974";
        const x = 20 + step * i;
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y(p.high)} y2={y(p.low)} stroke={color} />
            <rect
              x={x - Math.max(2, step * 0.29)}
              y={Math.min(y(p.open), y(p.close))}
              width={Math.max(4, step * 0.58)}
              height={Math.max(2, Math.abs(y(p.open) - y(p.close)))}
              fill={color}
              rx=".6"
            />
          </g>
        );
      })}
      <line
        x1="12"
        x2="531"
        y1={y(line)}
        y2={y(line)}
        stroke="#a6c6a5"
        strokeDasharray="4 4"
        opacity=".65"
      />
      <rect
        x="531"
        y={y(line) - 9}
        width="44"
        height="19"
        rx="2"
        fill="#a6c6a5"
      />
      <text
        x="553"
        y={y(line) + 4}
        textAnchor="middle"
        fill="#17251e"
        fontFamily="monospace"
        fontSize="10"
        fontWeight="600"
      >
        {line.toFixed(2)}
      </text>
      <line
        x1="329"
        x2="329"
        y1="28"
        y2="214"
        stroke="#a8b3a2"
        strokeDasharray="3 5"
        opacity=".4"
      />
      <circle cx="329" cy="216" r="8" fill="#b8c9a7" />
      <path
        d="m326 217 3-4 3 4"
        fill="none"
        stroke="#243326"
        strokeWidth="1.5"
      />
      <rect x="277" y="2" width="105" height="20" rx="3" fill="#344037" />
      <text x="329" y="15" textAnchor="middle" fill="#c8d6be" fontSize="9">
        42′ · Signal identified
      </text>
    </svg>
  );
}
function Flow() {
  return (
    <div className="flow">
      <div className="flow-head">
        <span>ATTACKING PRESSURE</span>
        <span>
          <i className="legend-green" />
          ARS <i className="legend-muted" />
          CHE
        </span>
      </div>
      <svg
        viewBox="0 0 570 47"
        role="img"
        aria-label="Illustrative attacking pressure over match time"
      >
        <line x1="0" x2="570" y1="23" y2="23" stroke="#3c4843" />
        {Array.from({ length: 72 }, (_, i) => {
          const up = Math.sin(i * 0.63) + Math.cos(i * 0.27) > -0.3;
          const h = 3 + Math.abs(Math.sin(i * 1.93) * 15);
          return (
            <rect
              key={i}
              x={i * 8}
              y={up ? 23 - h : 24}
              width="4.5"
              height={h}
              rx=".5"
              fill={up ? "#85aa86" : "#586962"}
            />
          );
        })}
      </svg>
      <div className="flow-foot">
        <span>0′</span>
        <span>HT</span>
        <span>64′</span>
      </div>
    </div>
  );
}
export function ProductPreview({ expanded = false }: { expanded?: boolean }) {
  const [market, setMarket] = useState<Market>("Arsenal");
  const [interval, setInterval] = useState(1);
  const data = marketData[market];
  return (
    <div
      className={`terminal ${expanded ? "terminal-expanded" : "terminal-compact"}`}
    >
      <div className="terminal-top">
        <div className="terminal-title">
          <span className="terminal-mark">↗</span>SoccerTradeView
          <span className="terminal-version"> / MATCH CENTRE</span>
        </div>
        <span className="demo-badge">ILLUSTRATIVE PREVIEW</span>
      </div>
      <div className="terminal-layout">
        {expanded && (
          <aside className="terminal-sidebar">
            <div className="side-label">WORKSPACE</div>
            <div className="side-active">
              <span>▥</span> Match analysis
            </div>
            <div>
              <span>⌁</span> Live signals
            </div>
            <div>
              <span>◷</span> Trade history
            </div>
            <div>
              <span>▤</span> Performance
            </div>
            <div className="side-label side-label-second">MATCH IN FOCUS</div>
            <div className="side-match">
              <span>
                ARS <b>1 : 0</b> CHE
              </span>
              <small>Premier League · 64′</small>
            </div>
            <div className="side-bottom">
              <span className="status-dot" />
              Sample match data
            </div>
          </aside>
        )}
        <div className="terminal-main">
          <div className="match-meta">
            <span>
              ENGLAND <span className="meta-separator">/</span> PREMIER LEAGUE
            </span>
            <span className="match-time">
              <span className="status-dot" />
              64:28
            </span>
          </div>
          <div className="match-header">
            <div className="team">
              <span className="team-badge team-ars">A</span>
              <span>
                Arsenal<small>HOME</small>
              </span>
            </div>
            <div className="match-score">
              1<span>:</span>0<small>2ND HALF</small>
            </div>
            <div className="team team-away">
              <span>
                Chelsea<small>AWAY</small>
              </span>
              <span className="team-badge team-che">C</span>
            </div>
          </div>
          <div
            className="market-selector"
            role="group"
            aria-label="Preview match winner market"
          >
            {(["Arsenal", "Draw", "Chelsea"] as const).map((item, i) => (
              <button
                key={item}
                onClick={() => setMarket(item)}
                aria-pressed={market === item}
                className={market === item ? "selected" : ""}
              >
                <span>
                  <span className="market-number">
                    {i === 1 ? "X" : i === 0 ? "1" : "2"}
                  </span>
                  {item}
                </span>
                <b>{marketData[item].value}</b>
              </button>
            ))}
          </div>
          <div className="chart-toolbar">
            <div>
              <span className="chart-label">
                {market === "Draw" ? "Draw" : `${market} to win`}
              </span>
              <span className="chart-odds">{data.value}</span>
              <span
                className={`odds-change ${market !== "Arsenal" ? "odds-rising" : ""}`}
              >
                {data.change}
              </span>
            </div>
            <div
              className="intervals"
              role="group"
              aria-label="Candle interval"
            >
              {[1, 5, 15].map((n) => (
                <button
                  key={n}
                  aria-pressed={interval === n}
                  onClick={() => setInterval(n)}
                  className={interval === n ? "active" : ""}
                >
                  {n}m
                </button>
              ))}
            </div>
          </div>
          <div className="chart-area">
            <OddsChart market={market} interval={interval} />
          </div>
          <Flow />
          <div className="terminal-bottom">
            <span>
              <span className="status-dot" /> MATCH CONTEXT + MARKET MOVEMENT
            </span>
            <span>DECIMAL ODDS</span>
          </div>
        </div>
        {expanded && (
          <aside className="match-stats">
            <div className="side-label">MATCH STATISTICS</div>
            <div className="stats-teams">
              <span>ARS</span>
              <span>CHE</span>
            </div>
            {[
              { label: "Possession", a: "58%", b: "42%", width: 58 },
              { label: "Shots", a: "12", b: "7", width: 63 },
              { label: "Shots on target", a: "5", b: "2", width: 71 },
              { label: "Corners", a: "6", b: "3", width: 67 },
            ].map((stat) => (
              <div className="stat" key={stat.label}>
                <div>
                  <b>{stat.a}</b>
                  <span>{stat.label}</span>
                  <b>{stat.b}</b>
                </div>
                <div className="stat-bar">
                  <i style={{ width: `${stat.width}%` }} />
                  <i />
                </div>
              </div>
            ))}
            <div className="side-label event-label">KEY EVENTS</div>
            <div className="match-event">
              <span>58′</span>
              <div>
                Substitution<small>Chelsea</small>
              </div>
              <b>⇄</b>
            </div>
            <div className="match-event">
              <span>42′</span>
              <div>
                Signal identified<small>Home odds movement</small>
              </div>
              <b>↗</b>
            </div>
            <div className="match-event">
              <span>34′</span>
              <div>
                Goal · Arsenal<small>Score: 1–0</small>
              </div>
              <b>◉</b>
            </div>
            <div className="pitch">
              <div className="pitch-line" />
              <div className="pitch-circle" />
              <div className="pitch-box pitch-box-left" />
              <div className="pitch-box pitch-box-right" />
              <span className="pitch-ball" />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
