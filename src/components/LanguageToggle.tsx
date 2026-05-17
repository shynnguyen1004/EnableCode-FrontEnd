import { useI18n, type Locale } from "../i18n/I18nProvider";

type LanguageToggleProps = {
  className?: string;
};

export default function LanguageToggle({ className = "" }: LanguageToggleProps) {
  const { locale, setLocale, t } = useI18n();

  const options: { value: Locale; label: string }[] = [
    { value: "en", label: t("settings.languageEnglish") },
    { value: "vi", label: t("settings.languageVietnamese") },
  ];

  return (
    <div className={`language-toggle${className ? ` ${className}` : ""}`} role="group" aria-label="Language">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`language-toggle-btn${locale === option.value ? " is-active" : ""}`}
          aria-pressed={locale === option.value}
          onClick={() => setLocale(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
