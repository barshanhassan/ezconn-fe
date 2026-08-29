import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ACTION_SCHEMAS,
  ActionFieldSchema,
  ActionSchema,
  CONDITION_TYPES,
  FieldType,
} from './action-schemas';
import { VariablePicker } from './VariablePicker';
import { ExternalRequestEditor } from './external-request-editor';

/**
 * Universal property editor for automation nodes. Renders the field set
 * declared in `ACTION_SCHEMAS` for the currently selected action slug, plus
 * a separate condition editor for `condition` step types.
 *
 * Persistence model: callers pass `value` + `onChange`. ActionEditor never
 * touches global state directly. The builder's sync-graph save sends this
 * value object as `properties.value` on the step's activity, which is the
 * exact shape the backend's `ActionHandlerService.dispatch()` reads.
 */

// ─── Lookup data passed in from the builder (already in scope) ──────

export interface IntegrationsContext {
  tags?: Array<{ id: any; name: string }>;
  custom_fields?: Array<{ id: any; label?: string; slug?: string; input_type?: string }>;
  assistants?: Array<{ id: any; name: string }>;
  ai_voice_agents?: Array<{ id: any; name: string }>;
  dify_bots?: Array<{ id: any; name: string }>;
  automations?: Array<{ id: any; name: string }>;
  users?: Array<{ id: any; name: string }>;
  pipelines?: Array<{ id: any; name: string }>;
  pipeline_stages?: Array<{ id: any; name: string; pl_id?: any }>;
  whatsapp_apps?: Array<{ id: any; name: string }>;
  bots?: Array<{ id: any; name: string }>;
  messenger_apps?: Array<{ id: any; name: string }>;
  instagram_apps?: Array<{ id: any; name: string }>;
  twilio_accounts?: Array<{ id: any; name: string }>;
  webchat_instances?: Array<{ id: any; name: string }>;
  zapi_instances?: Array<{ id: any; name: string }>;
  evolution_instances?: Array<{ id: any; name: string }>;
}

const SYSTEM_FIELDS = [
  'first_name',
  'last_name',
  'email',
  'mobile_number',
  'language',
  'locale',
  'timezone',
  'gender',
  'country_id',
  'phone_code',
  'subscribed_at',
  'source',
];

// ─── Generic primitives ─────────────────────────────────────────────

const Label: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
    {children}{required && <span className="text-red-500 ml-1">*</span>}
  </label>
);

const TextInput: React.FC<{
  value: any;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => (
  <input
    type="text"
    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
    value={value ?? ''}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
  />
);

const NumberInput: React.FC<{ value: any; onChange: (v: number) => void }> = ({ value, onChange }) => (
  <input
    type="number"
    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
    value={value ?? ''}
    onChange={(e) => onChange(Number(e.target.value))}
  />
);

const TextArea: React.FC<{
  value: any;
  onChange: (v: string) => void;
  rows?: number;
}> = ({ value, onChange, rows = 3 }) => (
  <textarea
    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 resize-y"
    rows={rows}
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value)}
  />
);

const Checkbox: React.FC<{ value: any; onChange: (v: boolean) => void; label: string }> = ({ value, onChange, label }) => (
  <label className="flex items-center gap-2 text-sm text-gray-700">
    <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
);

const Select: React.FC<{
  value: any;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}> = ({ value, onChange, options }) => (
  <select
    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value)}
  >
    <option value="">—</option>
    {options.map((o) => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

const JsonInput: React.FC<{ value: any; onChange: (v: any) => void }> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const [raw, setRaw] = React.useState<string>(() =>
    value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  );
  const [err, setErr] = React.useState<string>('');
  return (
    <div>
      <textarea
        className="w-full text-xs font-mono border border-gray-300 rounded px-2 py-1.5"
        rows={4}
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          if (!e.target.value.trim()) {
            setErr('');
            onChange(null);
            return;
          }
          try {
            const parsed = JSON.parse(e.target.value);
            setErr('');
            onChange(parsed);
          } catch (ex: any) {
            setErr('Invalid JSON');
          }
        }}
      />
      {err && <p className="text-[10px] text-red-500 mt-1">{t('action_editor.invalid_json')}</p>}
    </div>
  );
};

// ─── Field renderer ─────────────────────────────────────────────────

interface FieldRendererProps {
  field: ActionFieldSchema;
  value: any;
  onChange: (v: any) => void;
  integrations: IntegrationsContext;
  selectedPipelineId?: any;
}

const FieldRenderer: React.FC<FieldRendererProps> = ({ field, value, onChange, integrations, selectedPipelineId }) => {
  const type: FieldType = field.type;
  switch (type) {
    case 'text':
      return <TextInput value={value} onChange={onChange} placeholder={field.placeholder} />;
    case 'textarea':
      return <TextArea value={value} onChange={onChange} />;
    case 'number':
      return <NumberInput value={value} onChange={onChange} />;
    case 'checkbox':
      return <Checkbox value={value} onChange={onChange} label={field.label} />;
    case 'select':
      return <Select value={value} onChange={onChange} options={field.options ?? []} />;
    case 'json':
      return <JsonInput value={value} onChange={onChange} />;
    case 'tag':
      return (
        <Select
          value={value}
          onChange={onChange}
          options={(integrations.tags ?? []).map((t) => ({ value: String(t.id), label: t.name }))}
        />
      );
    case 'custom-field':
      return (
        <Select
          value={value}
          onChange={onChange}
          options={(integrations.custom_fields ?? []).map((f) => ({
            value: String(f.id),
            label: f.label ?? f.slug ?? `#${f.id}`,
          }))}
        />
      );
    case 'system-field':
      return (
        <Select
          value={value}
          onChange={onChange}
          options={SYSTEM_FIELDS.map((s) => ({ value: s, label: s }))}
        />
      );
    case 'ai-agent':
      return (
        <Select
          value={value}
          onChange={onChange}
          options={(integrations.assistants ?? []).map((a) => ({ value: String(a.id), label: a.name }))}
        />
      );
    case 'ai-voice-agent':
      return (
        <Select
          value={value}
          onChange={onChange}
          options={(integrations.ai_voice_agents ?? []).map((a) => ({ value: String(a.id), label: a.name }))}
        />
      );
    case 'dify-bot':
      return (
        <Select
          value={value}
          onChange={onChange}
          options={(integrations.dify_bots ?? []).map((b) => ({ value: String(b.id), label: b.name }))}
        />
      );
    case 'user':
      return (
        <Select
          value={value}
          onChange={onChange}
          options={(integrations.users ?? []).map((u) => ({ value: String(u.id), label: u.name }))}
        />
      );
    case 'automation':
      return (
        <Select
          value={value}
          onChange={onChange}
          options={(integrations.automations ?? []).map((a) => ({ value: String(a.id), label: a.name }))}
        />
      );
    case 'channel-account': {
      const list =
        field.channel === 'whatsapp' ? integrations.whatsapp_apps :
        field.channel === 'telegram' ? integrations.bots :
        field.channel === 'messenger' ? integrations.messenger_apps :
        field.channel === 'instagram' ? integrations.instagram_apps :
        field.channel === 'twilio_sms' || field.channel === 'twilio_call' ? integrations.twilio_accounts :
        field.channel === 'webchat' ? integrations.webchat_instances :
        field.channel === 'zapi' ? integrations.zapi_instances :
        field.channel === 'evolution' ? integrations.evolution_instances :
        [];
      return (
        <Select
          value={value}
          onChange={onChange}
          options={(list ?? []).map((a: any) => ({ value: String(a.id), label: a.name ?? `#${a.id}` }))}
        />
      );
    }
    case 'pipeline':
      return (
        <Select
          value={value}
          onChange={onChange}
          options={(integrations.pipelines ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
        />
      );
    case 'pipeline-stage': {
      const stages = (integrations.pipeline_stages ?? []).filter(
        (s) => !selectedPipelineId || String(s.pl_id) === String(selectedPipelineId),
      );
      return (
        <Select
          value={value}
          onChange={onChange}
          options={stages.map((s) => ({ value: String(s.id), label: s.name }))}
        />
      );
    }
    case 'list-of-keywords': {
      const arr = Array.isArray(value) ? value : value ? String(value).split(',') : [];
      return (
        <TextInput
          value={arr.join(', ')}
          onChange={(v) => onChange(v.split(',').map((x) => x.trim()).filter(Boolean))}
          placeholder="kw1, kw2, kw3"
        />
      );
    }
    default:
      return <TextInput value={value} onChange={onChange} />;
  }
};

// ─── Path get/set on nested objects ─────────────────────────────────

const getPath = (obj: any, path: string): any => {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
};
const setPath = (obj: any, path: string, value: any): any => {
  const parts = path.split('.');
  const out = { ...(obj ?? {}) };
  let cur: any = out;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    cur[p] = { ...(cur[p] ?? {}) };
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
  return out;
};

// ─── ActionEditor — public component ────────────────────────────────

export interface ActionEditorProps {
  actionSlug: string;
  value: any;
  onChange: (v: any) => void;
  integrations: IntegrationsContext;
}

export const ActionEditor: React.FC<ActionEditorProps> = ({ actionSlug, value, onChange, integrations }) => {
  const { t } = useTranslation();
  const schema: ActionSchema | undefined = ACTION_SCHEMAS[actionSlug];
  if (!schema) {
    return (
      <div className="p-4 text-sm text-gray-500">
        {t('action_editor.no_editor_defined')} <code className="font-mono">{actionSlug}</code>.
      </div>
    );
  }

  // Replyagent's ExternalRequest.vue is a special-case 4-tab editor with a
  // Test button — the flat schema in ACTION_SCHEMAS can't render its tabs +
  // KV/JSON body switcher + response viewer + JSON-path mapping table. So we
  // intercept the slug and render the dedicated component instead.
  if (actionSlug === 'external_request') {
    return (
      <div className="p-4 space-y-3">
        <div className="border-b border-gray-100 pb-2 mb-2">
          <div className="text-xs uppercase font-bold text-gray-400">{schema.group}</div>
          <div className="text-sm font-semibold text-gray-800">{schema.label}</div>
        </div>
        <ExternalRequestEditor value={value} onChange={onChange} />
      </div>
    );
  }

  const selectedPipelineId = getPath(value, 'pipeline.id');
  return (
    <div className="p-4 space-y-3">
      <div className="border-b border-gray-100 pb-2 mb-2">
        <div className="text-xs uppercase font-bold text-gray-400">{schema.group}</div>
        <div className="text-sm font-semibold text-gray-800">{schema.label}</div>
      </div>
      {schema.fields.map((f) => (
        <div key={f.key}>
          {f.type !== 'checkbox' && (
            <div className="flex justify-between items-center mb-1">
              <Label required={f.required}>{f.label}</Label>
              {(f.type === 'text' || f.type === 'textarea') && (
                <VariablePicker
                  integrations={integrations}
                  onInsert={(token) => {
                    const current = getPath(value, f.key) ?? '';
                    onChange(setPath(value, f.key, `${current}${token}`));
                  }}
                />
              )}
            </div>
          )}
          <FieldRenderer
            field={f}
            value={getPath(value, f.key)}
            onChange={(v) => onChange(setPath(value, f.key, v))}
            integrations={integrations}
            selectedPipelineId={selectedPipelineId}
          />
          {f.helpText && <p className="text-[10px] text-gray-500 mt-1">{f.helpText}</p>}
        </div>
      ))}
    </div>
  );
};

// ─── ConditionEditor — for `step.type === 'condition'` ──────────────

export interface ConditionEditorProps {
  value: any;
  onChange: (v: any) => void;
  integrations: IntegrationsContext;
}

export const ConditionEditor: React.FC<ConditionEditorProps> = ({ value, onChange, integrations }) => {
  const { t } = useTranslation();
  const type = value?.type ?? 'text';
  const typeSchema = CONDITION_TYPES.find((c) => c.key === type) ?? CONDITION_TYPES[0];
  return (
    <div className="p-4 space-y-3">
      <div className="border-b border-gray-100 pb-2 mb-2">
        <div className="text-xs uppercase font-bold text-gray-400">{t('action_editor.condition')}</div>
        <div className="text-sm font-semibold text-gray-800">{t('action_editor.branch_on_contact_value')}</div>
      </div>
      <div>
        <Label>{t('action_editor.condition_type')}</Label>
        <Select
          value={type}
          onChange={(v) => onChange({ ...(value ?? {}), type: v })}
          options={CONDITION_TYPES.map((c) => ({ value: c.key, label: c.label }))}
        />
      </div>
      <div>
        <Label>{t('action_editor.field')}</Label>
        {type === 'custom-field' || type === 'text' ? (
          <Select
            value={value?.field ?? ''}
            onChange={(v) => onChange({ ...(value ?? {}), field: v })}
            options={[
              ...SYSTEM_FIELDS.map((s) => ({ value: s, label: `${t('action_editor.system_prefix')} ${s}` })),
              ...(integrations.custom_fields ?? []).map((f) => ({
                value: f.slug ?? `#${f.id}`,
                label: `${t('action_editor.custom_prefix')} ${f.label ?? f.slug}`,
              })),
            ]}
          />
        ) : (
          <TextInput
            value={value?.field}
            onChange={(v) => onChange({ ...(value ?? {}), field: v })}
            placeholder={t('action_editor.field_placeholder')}
          />
        )}
      </div>
      <div>
        <Label>{t('action_editor.operator')}</Label>
        <Select
          value={value?.operator}
          onChange={(v) => onChange({ ...(value ?? {}), operator: v })}
          options={typeSchema.operators.map((op) => ({ value: op, label: op.replace(/_/g, ' ') }))}
        />
      </div>
      {!['is_true', 'is_false', 'is_empty', 'is_not_empty'].includes(value?.operator ?? '') && (
        <div>
          <Label>{t('action_editor.value')}</Label>
          <TextInput
            value={value?.value}
            onChange={(v) => onChange({ ...(value ?? {}), value: v })}
            placeholder={t('action_editor.value_placeholder')}
          />
        </div>
      )}
    </div>
  );
};
