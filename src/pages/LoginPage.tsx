import { FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, LogIn, Eye } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";

export default function LoginPage() {
  const { t } = useI18n();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <div className="login-page">
      <header className="login-header container">
        <Link to="/" className="login-back group">
          <ArrowLeft size={28} strokeWidth={3} className="nav-icon" />
          <span>{t("nav.back")}</span>
        </Link>

        <Link to="/" className="login-logo-link" aria-label={t("brand.homeAria")}>
          <img src="/logo/TD_App_Logo.png" alt={t("brand.logoDarkAlt")} className="login-logo" />
        </Link>
      </header>

      <main className="login-main container">
        <section className="login-card">
          <div className="login-intro">
            <h1>{t("login.welcome")}</h1>
            <p>{t("login.subtitle")}</p>
          </div>

          <form className="login-form" onSubmit={onSubmit}>
            <label htmlFor="email">{t("login.email")}</label>
            <input id="email" type="email" placeholder={t("login.emailPlaceholder")} />

            <label htmlFor="password">{t("login.password")}</label>
            <input id="password" type="password" placeholder="••••••••" />

            <Link to="/lessons" className="login-btn login-btn-primary group">
              <LogIn size={32} strokeWidth={3} className="btn-icon" />
              {t("login.login")}
            </Link>

            <div className="login-divider">
              <span />
              <strong>{t("login.or")}</strong>
              <span />
            </div>

            <button type="button" className="login-btn login-btn-secondary group">
              <Eye size={32} strokeWidth={3} className="btn-icon" />
              {t("login.eyeScan")}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
