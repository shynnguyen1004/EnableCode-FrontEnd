import { Link } from "react-router-dom";

import { Eye, MousePointerSquareDashed, BookOpenCheck, ArrowRight } from "lucide-react";

const features = [
  {
    title: "Eye Tracking",
    body: "Navigate, select, and code entirely hands-free. Our interface is optimized for high-precision eye-control hardware.",
    icon: <Eye size={36} strokeWidth={2.5} color="#fff" />,
    theme: "accent-green",
  },
  {
    title: "Drag-and-Drop",
    body: "Snap logical blocks together with ease. Extra-large drop zones ensure you never miss your target.",
    icon: <MousePointerSquareDashed size={36} strokeWidth={2.5} color="#fff" />,
    theme: "accent-light-green",
  },
  {
    title: "Inclusive Learning",
    body: "Step-by-step interactive tutorials adapted for diverse physical abilities. Learn at your own pace comfortably.",
    icon: <BookOpenCheck size={36} strokeWidth={2.5} color="#fff" />,
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
        <Link to="/lessons" className="btn btn-primary hero-cta group">
          Get Started
          <ArrowRight size={32} className="hero-arrow" strokeWidth={3} style={{ marginLeft: '12px' }} />
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
