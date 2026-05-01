import { Link } from "react-router-dom";

const features = [
  {
    title: "Eye Tracking",
    body: "Navigate and code hands-free with controls optimized for eye-tracking input.",
    icon: "O",
    theme: "accent-green",
  },
  {
    title: "Drag-and-Drop",
    body: "Build logic blocks with larger drop targets for accessible interaction.",
    icon: "[]",
    theme: "accent-light-green",
  },
  {
    title: "Inclusive Learning",
    body: "Follow guided lessons designed for learners with diverse physical abilities.",
    icon: "B",
    theme: "accent-orange",
  },
];

export default function HomePage() {
  return (
    <div className="home-wrap">
      <header className="top-nav container">
        <Link to="/" className="brand-link" aria-label="Enable Code Home">
          <img src="/logo/TL_App_Logo.png" alt="Enable Code logo light mode" className="brand-logo" />
        </Link>
        <nav className="menu">
          <a href="#features" className="btn btn-ghost">
            Features
          </a>
          <a href="#about" className="btn btn-ghost">
            About
          </a>
          <Link to="/login" className="btn btn-primary">
            Log In
          </Link>
        </nav>
      </header>

      <main className="hero container">
        <h1>
          Code with your <span>Eyes</span>
        </h1>
        <p>
          An inclusive platform to build web apps through eye-tracking and intuitive block-based
          interactions.
        </p>
        <Link to="/lessons" className="btn btn-primary hero-cta">
          Get Started
        </Link>
      </main>

      <section id="features" className="features-section">
        <div className="container">
          <h2>
            Designed for <span>Accessibility</span>
          </h2>
          <div className="feature-grid">
            {features.map((feature) => (
              <article key={feature.title} className={`feature-card ${feature.theme}`}>
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer id="about" className="site-footer">
        <div className="container footer-inner">
          <Link to="/" className="footer-brand-link" aria-label="Enable Code Home">
            <img src="/logo/TD_App_Logo.png" alt="Enable Code logo dark mode" className="footer-logo" />
          </Link>
          <div className="footer-links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
