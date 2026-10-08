import { Brand, ButtonLink } from "../components/ui";

export default function NotFound() {
  return (
    <main className="state-page">
      <Brand />
      <p className="eyebrow">Off the pitch</p>
      <h1>This page isn’t in play.</h1>
      <p>Let’s get you back to the football.</p>
      <ButtonLink to="/">Back to home</ButtonLink>
    </main>
  );
}
