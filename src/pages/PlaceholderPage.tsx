import { Link } from "react-router-dom";

type PlaceholderPageProps = {
  title: string;
  message: string;
};

export default function PlaceholderPage({ title, message }: PlaceholderPageProps) {
  return (
    <main className="placeholder-wrap">
      <section className="placeholder-card">
        <p className="placeholder-kicker">In progress</p>
        <h1>{title}</h1>
        <p>{message}</p>
        <Link to="/" className="btn btn-primary">
          Back to Home
        </Link>
      </section>
    </main>
  );
}
