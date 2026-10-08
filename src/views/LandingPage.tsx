import Link from "next/link";
import Image from "next/image";
import { Arrow, Brand, ButtonLink, Eyebrow } from "../components/ui";
import { Header } from "../components/Header";
import { SoccerTradeViewSection } from "../components/SoccerTradeViewSection";
import { ExperienceMotion } from "../components/ExperienceMotion";

function Hero() {
  return (
    <section className="hero container">
      <div className="hero-copy">
        <Eyebrow>The game, the market, your edge</Eyebrow>
        <h1>
          See the match.
          <br />
          Read the market.
          <br />
          <span>Find your edge.</span>
        </h1>
        <p>
          Football data, market movement and clear signals.
          <br className="desktop-break" /> All in one analytical workspace.
          Built for a more
          <br className="desktop-break" /> considered approach to the game.
        </p>
        <div className="hero-actions">
          <ButtonLink>Get Started</ButtonLink>
          <ButtonLink to="/login" secondary>
            Sign In
          </ButtonLink>
        </div>
        <div className="hero-note">
          <span className="note-mark" aria-hidden="true">
            —
          </span>
          Less noise. More context. Better-informed decisions.
        </div>
      </div>
      <figure className="hero-artwork">
        <Image
          src="/football-artwork.png"
          alt="Footballer striking a ball beside a mobile football interface"
          width={2048}
          height={1536}
          sizes="(max-width: 740px) 100vw, 62vw"
          preload
        />
        <figcaption>
          <span>The beautiful game, from a different perspective</span>
          <a href="#soccertradeview">
            Explore SoccerTradeView <Arrow diagonal />
          </a>
        </figcaption>
      </figure>
      <div className="hero-index">
        <span>Built around the game</span>
        <div />
        <span>Scroll to explore ↓</span>
      </div>
    </section>
  );
}
function PlatformStrip() {
  return (
    <div className="platform-strip" data-reveal>
      <div className="container">
        <span>
          A COMPLETE VIEW
          <br />
          <b>OF THE GAME.</b>
        </span>
        <div>
          <span className="strip-icon">⌁</span>Live match signals
        </div>
        <div>
          <span className="strip-icon">▥</span>Odds movement
        </div>
        <div>
          <span className="strip-icon">◷</span>Football context
        </div>
        <div>
          <span className="strip-icon">↗</span>Performance tracking
        </div>
      </div>
    </div>
  );
}
const features = [
  {
    title: "Signals with substance.",
    copy: "Follow structured signals as match and market conditions develop. See the context behind the moment.",
    label: "Live signals",
    type: "signal",
  },
  {
    title: "The full match picture.",
    copy: "Read odds movement alongside match statistics, key events and the flow of the game.",
    label: "Match analysis",
    type: "analysis",
  },
  {
    title: "A record you can review.",
    copy: "Revisit signals, review outcomes and track performance over time. Make reflection part of your process.",
    label: "History and performance",
    type: "history",
  },
];
function FeatureGraphic({ type }: { type: string }) {
  if (type === "signal")
    return (
      <div className="feature-graphic signal-graphic">
        <div className="sample-label">A signal in context</div>
        <div className="signal-row">
          <span className="signal-icon">↗</span>
          <div>
            <b>Market movement identified</b>
            <span>
              ARS v CHE <i>·</i> 42′ <i>·</i> Home win
            </span>
          </div>
          <span className="signal-status">Review</span>
        </div>
        <div className="signal-baseline">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  if (type === "analysis")
    return (
      <div className="feature-graphic analysis-graphic">
        <div className="sample-label">The story of the match</div>
        <div className="analysis-row">
          <span>Match flow</span>
          <svg viewBox="0 0 170 35" aria-hidden="true">
            <path
              d="m0 25 10-3 10 4 10-12 10 9 10-4 10 5 10-17 10 8 10-9 10 12 10-4 10-11 10 8 10-5 10 3 10-7"
              fill="none"
              stroke="#829984"
              strokeWidth="1.8"
            />
          </svg>
        </div>
        <div className="analysis-row">
          <span>Market odds</span>
          <svg viewBox="0 0 170 35" aria-hidden="true">
            <path
              d="m0 6 10 3 10-2 10 9 10-3 10 4 10-6 10 8 10 2 10-4 10 6 10-2 10 5 10-2 10 4 10-2 10 4"
              fill="none"
              stroke="#bd655e"
              strokeWidth="1.8"
            />
          </svg>
        </div>
      </div>
    );
  return (
    <div className="feature-graphic history-graphic">
      <div className="sample-label">Everything worth revisiting</div>
      {[
        ["Signal history", "Recorded"],
        ["Match context", "Connected"],
        ["Performance", "In perspective"],
      ].map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}
function FeatureSection() {
  return (
    <section id="platform" className="section container features-section">
      <div className="section-intro" data-reveal>
        <div>
          <Eyebrow>A more complete perspective</Eyebrow>
          <h2>
            Football moves fast.
            <br />
            Make sense of it.
          </h2>
        </div>
        <p>
          A single number never tells the whole story.
          <br />
          Bring the match, the market and your analysis
          <br className="desktop-break" /> together, without switching between
          tools.
        </p>
      </div>
      <div className="feature-grid">
        {features.map((feature) => (
          <article className="feature" key={feature.title} data-reveal>
            <div className="feature-top">
              <span>{feature.label}</span>
            </div>
            <FeatureGraphic type={feature.type} />
            <h3>{feature.title}</h3>
            <p>{feature.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
function HowItWorks() {
  const steps = [
    {
      title: "Make it yours.",
      text: "Create your Prime Edge Football account.",
    },
    {
      title: "Choose your access.",
      text: "Review available subscriptions and select your plan.",
    },
    {
      title: "Get the full picture.",
      text: "Explore live signals and match analysis in your workspace.",
    },
    {
      title: "Build your process.",
      text: "Review your signal history and performance over time.",
    },
  ];
  return (
    <section className="section container how-section" id="how-it-works">
      <div className="section-intro" data-reveal>
        <div>
          <Eyebrow>From first look to full context</Eyebrow>
          <h2>A straightforward way in.</h2>
        </div>
        <Link className="inline-link" href="/signup">
          Create your account <Arrow diagonal />
        </Link>
      </div>
      <div className="steps">
        {steps.map((step) => (
          <article key={step.title} data-reveal>
            <div className="step-marker" aria-hidden="true">
              <span />
            </div>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
function SubscriptionCTA() {
  return (
    <section className="membership container" id="membership" data-reveal>
      <div className="membership-copy">
        <Eyebrow light>A better view starts here</Eyebrow>
        <h2>
          Bring more perspective
          <br />
          to your matchday.
        </h2>
        <p>
          One subscription. A connected football analytics experience.
          <br />
          Create your account to explore available plans.
        </p>
        <div className="membership-actions">
          <ButtonLink>Get Started</ButtonLink>
          <Link href="/login">
            Already a member?{" "}
            <b>
              Sign In <Arrow />
            </b>
          </Link>
        </div>
      </div>
      <div className="membership-includes">
        <span>Your analytical workspace</span>
        {[
          "SoccerTradeView match analysis",
          "Structured live match signals",
          "Odds charts and football context",
          "Signal history and performance",
        ].map((item) => (
          <div key={item}>
            <span className="list-dot" aria-hidden="true" />
            {item}
          </div>
        ))}
        <p>Plan details are presented before you subscribe.</p>
      </div>
      <div className="membership-watermark" aria-hidden="true">
        PE
      </div>
    </section>
  );
}
function TrustNote() {
  return (
    <section className="trust-note container" data-reveal>
      <span className="trust-symbol">↗</span>
      <div>
        <h3>Built for analysis. Grounded in reality.</h3>
        <p>
          Good analysis starts with context, not promises. Prime Edge Football
          provides information to support your own decisions. Signals are not
          guarantees, and past outcomes do not predict future results.
        </p>
      </div>
      <span className="trust-label">PERSPECTIVE OVER PROMISES.</span>
    </section>
  );
}
function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div>
            <Brand />
            <p>A clearer perspective on the beautiful game.</p>
          </div>
          <nav aria-label="Footer platform links">
            <span>PLATFORM</span>
            <a href="#platform">The platform</a>
            <a href="#soccertradeview">SoccerTradeView</a>
            <a href="#how-it-works">How it works</a>
          </nav>
          <nav aria-label="Footer account links">
            <span>YOUR ACCOUNT</span>
            <a href="#membership">Membership</a>
            <Link href="/login">Sign In</Link>
            <Link href="/signup">
              Get Started <Arrow diagonal />
            </Link>
          </nav>
          <a href="#top" className="back-top">
            BACK TO TOP <span>↑</span>
          </a>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Prime Edge Football. All rights
            reserved.
          </span>
          <span>FOOTBALL DATA. MARKET PERSPECTIVE.</span>
        </div>
      </div>
    </footer>
  );
}
export function LandingPage() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div id="top" />
      <ExperienceMotion />
      <Header />
      <main id="main-content">
        <Hero />
        <PlatformStrip />
        <FeatureSection />
        <SoccerTradeViewSection />
        <HowItWorks />
        <SubscriptionCTA />
        <TrustNote />
      </main>
      <Footer />
    </>
  );
}
