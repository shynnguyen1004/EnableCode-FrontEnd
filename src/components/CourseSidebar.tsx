import { Link } from "react-router-dom";
import { Home, BookOpen, Settings } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";

type CourseSidebarProps = {
  active: "home" | "lessons" | "settings";
};

export default function CourseSidebar({ active }: CourseSidebarProps) {
  const { t } = useI18n();

  return (
    <aside className="lessons-sidebar">
      <div className="lessons-sidebar-brand">
        <Link to="/" aria-label={t("brand.homeAria")}>
          <img src="/logo/TL_App_Logo.png" alt={t("brand.logoLightAlt")} className="lessons-logo" />
        </Link>
      </div>

      <nav className="lessons-nav">
        <Link to="/" className={`lessons-nav-link${active === "home" ? " is-active" : ""}`}>
          <Home size={28} strokeWidth={2.5} className="nav-icon" />
          <span>{t("nav.home")}</span>
        </Link>
        <Link to="/lessons" className={`lessons-nav-link${active === "lessons" ? " is-active" : ""}`}>
          <BookOpen size={28} strokeWidth={2.5} className="nav-icon" />
          <span>{t("nav.lessons")}</span>
        </Link>
        <Link to="/settings" className={`lessons-nav-link${active === "settings" ? " is-active" : ""}`}>
          <Settings size={28} strokeWidth={2.5} className="nav-icon" />
          <span>{t("nav.settings")}</span>
        </Link>
      </nav>
    </aside>
  );
}
