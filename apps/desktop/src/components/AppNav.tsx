import type { ReactNode } from "react";
import { localeShortLabel, useI18n } from "../i18n";

type WorkspaceTab =
  | "workflow"
  | "tasks"
  | "learning"
  | "settings";

type NavItem = {
  tab: WorkspaceTab;
  label: string;
  ariaLabel: string;
  title: string;
  shortcut: string;
};

type AppNavProps = {
  activeTab: WorkspaceTab;
  hidden?: boolean;
  onSelectTab: (tab: WorkspaceTab) => void;
  renderIcon: (tab: WorkspaceTab, active: boolean) => ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { tab: "tasks", label: "nav.tasks", ariaLabel: "nav.tasks", title: "nav.tasks", shortcut: "Cmd+1" },
  { tab: "learning", label: "nav.learning", ariaLabel: "nav.learning", title: "nav.learning", shortcut: "Cmd+2" },
  { tab: "workflow", label: "nav.workflow.short", ariaLabel: "nav.workflow.title", title: "nav.workflow.title", shortcut: "Cmd+3" },
  { tab: "settings", label: "nav.settings", ariaLabel: "nav.settings", title: "nav.settings", shortcut: "Cmd+4" },
];
const SHOW_LANGUAGE_SWITCH = false;

export default function AppNav({ activeTab, hidden = false, onSelectTab, renderIcon }: AppNavProps) {
  const { locale, cycleLocale, t } = useI18n();

  return (
    <aside aria-hidden={hidden} className={`left-nav${hidden ? " is-hidden" : ""}`}>
      <nav className="nav-list">
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.tab;
          const ariaLabel = item.ariaLabel.startsWith("nav.") ? t(item.ariaLabel) : item.ariaLabel;
          const title = item.title.startsWith("nav.") ? t(item.title) : item.title;
          return (
            <button
              aria-label={ariaLabel}
              className={active ? "is-active" : ""}
              key={item.tab}
              onClick={() => onSelectTab(item.tab)}
              title={`${title} · ${item.shortcut}`}
              type="button"
            >
              <span className="nav-icon">{renderIcon(item.tab, active)}</span>
            </button>
          );
        })}
      </nav>
      {SHOW_LANGUAGE_SWITCH && (
        <div className="nav-footer">
          <button
            aria-label={t("nav.language")}
            className="nav-lang-button"
            onClick={cycleLocale}
            title={`${t("nav.language")} · ${t(`lang.${locale}`)}`}
            type="button"
          >
            <span className="nav-lang-code">{localeShortLabel(locale)}</span>
          </button>
        </div>
      )}
    </aside>
  );
}
