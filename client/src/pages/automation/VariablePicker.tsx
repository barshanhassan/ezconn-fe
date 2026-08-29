import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IntegrationsContext } from './ActionEditor';

/**
 * Variable / token picker — a small "+" button that opens a popover listing
 * available variables the user can insert into any text field. Tokens follow
 * replyagent's syntax:
 *
 *   {{contact.first_name}}        — contact system field
 *   {{contact.field.<slug>}}      — contact custom field
 *   {{flow.<step_label>.text}}    — previous step's output (e.g. ChatGPT answer)
 *   {{now}} / {{now.iso}}         — current timestamp helpers
 *
 * Backend's action handlers replace these at execution time via
 * `injectContactId()` and the templating helper. Adding new variable kinds
 * means extending the list here and the matching backend helper.
 */

interface VariablePickerProps {
  onInsert: (token: string) => void;
  integrations: IntegrationsContext;
}

export const VariablePicker: React.FC<VariablePickerProps> = ({ onInsert, integrations }) => {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const SYSTEM_FIELDS = [
    { key: 'first_name', label: t('variable_picker.first_name') },
    { key: 'last_name', label: t('variable_picker.last_name') },
    { key: 'full_name', label: t('variable_picker.full_name') },
    { key: 'email', label: t('variable_picker.email') },
    { key: 'mobile_number', label: t('variable_picker.mobile') },
    { key: 'language', label: t('variable_picker.language') },
    { key: 'locale', label: t('variable_picker.locale') },
    { key: 'timezone', label: t('variable_picker.timezone') },
  ];

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const insert = (token: string) => {
    onInsert(token);
    setOpen(false);
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[10px] uppercase font-bold text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 border border-indigo-200 rounded bg-white"
        title={t('variable_picker.insert_variable')}
      >
        + var
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-[260px] max-h-[360px] overflow-auto bg-white border border-gray-200 rounded shadow-xl">
          <Section label={t('variable_picker.contact_system')}>
            {SYSTEM_FIELDS.map((f) => (
              <Token key={f.key} label={f.label} token={`{{contact.${f.key}}}`} onInsert={insert} />
            ))}
          </Section>
          {(integrations.custom_fields ?? []).length > 0 && (
            <Section label={t('variable_picker.contact_custom')}>
              {(integrations.custom_fields ?? []).map((f: any) => (
                <Token
                  key={f.id}
                  label={f.label ?? f.slug}
                  token={`{{contact.field.${f.slug}}}`}
                  onInsert={insert}
                />
              ))}
            </Section>
          )}
          <Section label={t('variable_picker.time_helpers')}>
            <Token label={t('variable_picker.now_iso')} token="{{now.iso}}" onInsert={insert} />
            <Token label={t('variable_picker.now_epoch')} token="{{now.epoch}}" onInsert={insert} />
            <Token label={t('variable_picker.today_date')} token="{{now.date}}" onInsert={insert} />
          </Section>
          <Section label={t('variable_picker.workspace')}>
            <Token label={t('variable_picker.workspace_id')} token="{{workspace.id}}" onInsert={insert} />
          </Section>
        </div>
      )}
    </div>
  );
};

const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="px-3 py-1 text-[10px] uppercase font-bold text-gray-500 bg-gray-50 sticky top-0">
      {label}
    </div>
    {children}
  </div>
);

const Token: React.FC<{ label: string; token: string; onInsert: (t: string) => void }> = ({ label, token, onInsert }) => (
  <button
    type="button"
    onClick={() => onInsert(token)}
    className="block w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50"
  >
    <span className="text-gray-700">{label}</span>
    <span className="text-gray-400 text-[10px] ml-2 font-mono">{token}</span>
  </button>
);
