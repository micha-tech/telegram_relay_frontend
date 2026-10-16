"use client";

import Image from "next/image";
import { useState } from "react";

export function RunningPlayer() {
  const [paused, setPaused] = useState(false);
  return (
    <div className={`running-player ${paused ? "running-paused" : ""}`}>
      <div
        className="running-scene"
        role="img"
        aria-label="Prime Edge Football player running across the hero with a ball"
      >
        <div className="running-track" aria-hidden="true">
          <div className="running-sprite" />
        </div>
      </div>
      <Image
        className="running-fallback"
        src="/football-striker-branded.png"
        alt="Footballer wearing a Prime Edge Football shirt, striking a ball"
        width={1254}
        height={1254}
        sizes="(max-width: 740px) 90vw, 50vw"
      />
      <button
        className="running-toggle"
        type="button"
        aria-pressed={paused}
        onClick={() => setPaused(!paused)}
      >
        {paused ? "Play animation" : "Pause animation"}
      </button>
    </div>
  );
}
