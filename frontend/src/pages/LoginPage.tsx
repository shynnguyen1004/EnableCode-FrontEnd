import { FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, LogIn, Eye } from "lucide-react";

export default function LoginPage() {
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <div className="login-page">
      <header className="login-header container">
        <Link to="/" className="login-back group">
          <ArrowLeft size={28} strokeWidth={3} className="nav-icon" />
          <span>Back</span>
        </Link>

        <Link to="/" className="login-logo-link" aria-label="Enable Code Home">
          <img src="/logo/TD_App_Logo.png" alt="Enable Code logo dark mode" className="login-logo" />
        </Link>
      </header>

      <main className="login-main container">
        <section className="login-card">
          <div className="login-intro">
            <h1>Welcome Back</h1>
            <p>Sign in to continue your accessible coding journey.</p>
          </div>

          <form className="login-form" onSubmit={onSubmit}>
            <label htmlFor="email">Email Address</label>
            <input id="email" type="email" placeholder="hello@example.com" />

            <label htmlFor="password">Password</label>
            <input id="password" type="password" placeholder="••••••••" />

            <Link to="/lessons" className="login-btn login-btn-primary group">
              <LogIn size={32} strokeWidth={3} className="btn-icon" />
              Login
            </Link>

            <div className="login-divider">
              <span />
              <strong>or</strong>
              <span />
            </div>

            <button type="button" className="login-btn login-btn-secondary group">
              <Eye size={32} strokeWidth={3} className="btn-icon" />
              Login with Eye-Scan
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
