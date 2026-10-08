"use client";

import { useState } from "react";
import { Eyebrow } from "./ui";
import { ProductPreview } from "./ProductPreview";

export function SoccerTradeViewSection() {
  const [active, setActive] = useState(0);
  const details = [
    {
      title: "Follow the market",
      text: "Switch between home, draw and away odds. Use candle intervals to inspect how the market develops across a match.",
    },
    {
      title: "Read the game",
      text: "Keep possession, shots, attacking pressure and key events beside the chart. Judge market movement in its football context.",
    },
    {
      title: "Connect the signals",
      text: "Place signal markers on the match timeline and revisit the conditions around them. Every moment belongs to a bigger picture.",
    },
  ];
  return (
    <section id="soccertradeview" className="product-section">
      <div className="container">
        <div className="section-intro">
          <div>
            <Eyebrow>INTRODUCING SOCCERTRADEVIEW</Eyebrow>
            <h2>
              The match and the market.
              <br />
              Finally, in the same view.
            </h2>
          </div>
          <p>
            Your dedicated football analysis environment.
            <br />
            Price action, match flow and meaningful context,
            <br className="desktop-break" /> brought together on one screen.
          </p>
        </div>
        <div className="product-browser">
          <div className="browser-bar">
            <div className="browser-dots">
              <i />
              <i />
              <i />
            </div>
            <span>PRIME EDGE FOOTBALL / SOCCERTRADEVIEW</span>
            <span className="browser-secure">▣ &nbsp; PRODUCT PREVIEW</span>
          </div>
          <ProductPreview expanded />
        </div>
        <div className="product-disclaimer">
          <span>
            Illustrative match data · Explore the markets and chart intervals
            above.
          </span>
          <span>DESIGNED FOR CLARITY.</span>
        </div>
        <div className="product-details">
          {details.map((detail, i) => (
            <div
              className={`product-detail ${active === i ? "detail-active" : ""}`}
              key={detail.title}
            >
              <button
                aria-expanded={active === i}
                aria-controls={`detail-${i}`}
                onClick={() => setActive(i)}
              >
                <span>0{i + 1}</span>
                {detail.title}
                <span className="detail-symbol">
                  {active === i ? "−" : "+"}
                </span>
              </button>
              <p id={`detail-${i}`} hidden={active !== i}>
                {detail.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
