import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IntegrationsContext } from './ActionEditor';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

/**
 * Editor for non-action step types: `delay`, `smart_loop`, `randomizer`,
 * `splitter`, and the per-channel message composers (`whatsapp`, `telegram`,
 * `messenger`, `instagram`, `webchat`, `twilio_sms`, `twilio_call`, `zapi`,
 * `evolution`, `email`).
 *
 * Each panel writes into `node.data.value` so the builder's sync-graph save
 * carries it as the activity's `properties.value` — the exact shape the
 * backend's MessagingService / processor's delay+loop handlers read.
 */

interface Props {
  stepType: string;
  value: any;
  onChange: (v: any) => void;
  integrations: IntegrationsContext;
}

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">{children}</label>
);

const TextInput: React.FC<{ value: any; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => (
  <input
    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
    value={value ?? ''}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
  />
);
const NumberInput: React.FC<{ value: any; onChange: (v: number) => void; min?: number }> = ({ value, onChange, min }) => (
  <input
    type="number"
    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
    value={value ?? ''}
    min={min}
    onChange={(e) => onChange(Number(e.target.value))}
  />
);
const TextArea: React.FC<{ value: any; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <textarea
    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 resize-y"
    rows={4}
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value)}
  />
);
const Select: React.FC<{ value: any; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }> = ({ value, onChange, options }) => (
  <select className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
    <option value="">—</option>
    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);
const Checkbox: React.FC<{ value: any; onChange: (v: boolean) => void; label: string }> = ({ value, onChange, label }) => (
  <label className="flex items-center gap-2 text-sm text-gray-700">
    <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
);

// ─── Channel message editors ────────────────────────────────────────

const QuickReplyFollowup: React.FC<{ value: any; onChange: (v: any) => void }> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const qr = value?.quickReply ?? {};
  const set = (k: string, v: any) => onChange({ ...(value ?? {}), quickReply: { ...qr, [k]: v } });
  const unitOptions = ['seconds', 'minutes', 'hours', 'days'].map((u) => ({ value: u, label: t(`step_properties_editor.units.${u}`) }));
  return (
    <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-2">
      <div className="text-[11px] font-bold uppercase text-gray-500">{t('step_properties_editor.quick_reply_followup')}</div>
      <Checkbox value={qr.followUp} onChange={(v) => set('followUp', v)} label={t('step_properties_editor.send_followup_if_no_reply')} />
      {qr.followUp && (
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t('step_properties_editor.after')}</Label><NumberInput value={qr.followUpUnit ?? 5} onChange={(v) => set('followUpUnit', v)} min={1} /></div>
          <div>
            <Label>{t('step_properties_editor.unit')}</Label>
            <Select
              value={qr.followUpInterval ?? 'minutes'}
              onChange={(v) => set('followUpInterval', v)}
              options={unitOptions}
            />
          </div>
        </div>
      )}
      <Checkbox value={qr.retry} onChange={(v) => set('retry', v)} label={t('step_properties_editor.retry_on_missing_selection')} />
      {qr.retry && (
        <>
          <div><Label>{t('step_properties_editor.retry_attempts')}</Label><NumberInput value={qr.retryAttempts ?? 2} onChange={(v) => set('retryAttempts', v)} min={1} /></div>
          <div><Label>{t('step_properties_editor.retry_message')}</Label><TextInput value={qr.retryMessage ?? t('step_properties_editor.default_retry_message')} onChange={(v) => set('retryMessage', v)} /></div>
        </>
      )}
    </div>
  );
};

const WhatsAppTemplatePicker: React.FC<{ value: any; onChange: (v: any) => void }> = ({ value, onChange }) => {
  // Fetches the workspace's WhatsApp template list. Reuses the existing
  // /whatsapp/templates endpoint so creator UI + automation editor stay in
  // sync — no hardcoded template names.
  const { data: templates } = useQuery({
    queryKey: ['/api/whatsapp/templates'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/whatsapp/templates');
      return res.json();
    },
  });
  const list = Array.isArray(templates) ? templates : templates?.templates ?? [];
  return (
    <Select
      value={value?.template?.name ?? ''}
      onChange={(v) => onChange({ ...(value ?? {}), template: { ...(value?.template ?? {}), name: v } })}
      options={list.map((tpl: any) => ({ value: tpl.name ?? tpl.id, label: tpl.name ?? `#${tpl.id}` }))}
    />
  );
};

const WhatsAppEditor: React.FC<Props> = ({ value, onChange, integrations }) => {
  const { t } = useTranslation();
  const mode = value?.step_mode ?? 'in_24';
  return (
    <div className="space-y-3">
      <div>
        <Label>{t('step_properties_editor.whatsapp_account')}</Label>
        <Select
          value={value?.wa_account_id ?? ''}
          onChange={(v) => onChange({ ...(value ?? {}), wa_account_id: v })}
          options={(integrations.whatsapp_apps ?? []).map((a: any) => ({ value: String(a.id), label: a.name }))}
        />
      </div>
      <div>
        <Label>{t('step_properties_editor.send_mode')}</Label>
        <Select
          value={mode}
          onChange={(v) => onChange({ ...(value ?? {}), step_mode: v })}
          options={[
            { value: 'in_24', label: t('step_properties_editor.mode_in_24') },
            { value: 'template', label: t('step_properties_editor.mode_template') },
            { value: 'custom', label: t('step_properties_editor.mode_custom') },
          ]}
        />
      </div>
      {mode === 'template' && (
        <div>
          <Label>{t('step_properties_editor.template')}</Label>
          <WhatsAppTemplatePicker value={value} onChange={onChange} />
        </div>
      )}
      {mode !== 'template' && (
        <div>
          <Label>{t('step_properties_editor.message_body')}</Label>
          <TextArea value={value?.text} onChange={(v) => onChange({ ...(value ?? {}), text: v })} />
        </div>
      )}
      <QuickReplyFollowup value={value} onChange={onChange} />
    </div>
  );
};

/**
 * Per-channel send-mode picker. Mirrors WhatsApp's `in_24 / template / custom`
 * trichotomy for every Meta-facing channel:
 *   in_24   : send within the 24-hour user-initiated window only
 *   template: send a preapproved template (works anytime, but limited)
 *   custom  : send arbitrary content (requires open window for Meta channels)
 * Telegram + Twilio just default to `custom` (no window constraint).
 */
const SimpleChannelEditor: React.FC<Props & { accountKey: string; accountLabel: string; accountList: any[]; supportsTemplate?: boolean; supportsWindow?: boolean }> = ({ stepType, value, onChange, accountKey, accountLabel, accountList, supportsTemplate, supportsWindow }) => {
  const { t } = useTranslation();
  const mode = value?.step_mode ?? (supportsWindow ? 'in_24' : 'custom');
  const modeOptions: Array<{ value: string; label: string }> = [];
  if (supportsWindow) modeOptions.push({ value: 'in_24', label: t('step_properties_editor.mode_in_24') });
  if (supportsTemplate) modeOptions.push({ value: 'template', label: t('step_properties_editor.mode_template') });
  modeOptions.push({ value: 'custom', label: t('step_properties_editor.mode_custom') });

  return (
    <div className="space-y-3">
      <div>
        <Label>{accountLabel}</Label>
        <Select
          value={value?.[accountKey] ?? ''}
          onChange={(v) => onChange({ ...(value ?? {}), [accountKey]: v })}
          options={accountList.map((a: any) => ({ value: String(a.id), label: a.name ?? `#${a.id}` }))}
        />
      </div>
      {(supportsWindow || supportsTemplate) && modeOptions.length > 1 && (
        <div>
          <Label>{t('step_properties_editor.send_mode')}</Label>
          <Select value={mode} onChange={(v) => onChange({ ...(value ?? {}), step_mode: v })} options={modeOptions} />
        </div>
      )}
      <div>
        <Label>{mode === 'template' ? t('step_properties_editor.template_id') : t('step_properties_editor.message_body')}</Label>
        {mode === 'template' ? (
          <TextInput value={value?.template?.name ?? value?.template_id ?? ''} onChange={(v) => onChange({ ...(value ?? {}), template: { ...(value?.template ?? {}), name: v } })} placeholder="template_slug" />
        ) : (
          <TextArea value={value?.text} onChange={(v) => onChange({ ...(value ?? {}), text: v })} />
        )}
      </div>
      <QuickReplyFollowup value={value} onChange={onChange} />
    </div>
  );
};

// ─── Control flow editors ───────────────────────────────────────────

const DelayEditor: React.FC<{ value: any; onChange: (v: any) => void }> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const unitOptions = ['seconds', 'minutes', 'hours', 'days', 'weeks'].map((u) => ({ value: u, label: t(`step_properties_editor.units.${u}`) }));
  return (
    <div className="space-y-3">
      <div>
        <Label>{t('step_properties_editor.wait_amount')}</Label>
        <NumberInput value={value?.waitAmount} onChange={(v) => onChange({ ...(value ?? {}), waitAmount: v })} min={1} />
      </div>
      <div>
        <Label>{t('step_properties_editor.unit')}</Label>
        <Select
          value={value?.waitUnit ?? 'minutes'}
          onChange={(v) => onChange({ ...(value ?? {}), waitUnit: v })}
          options={unitOptions}
        />
      </div>
    </div>
  );
};

const SmartLoopEditor: React.FC<{ value: any; onChange: (v: any) => void }> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const unitOptions = ['seconds', 'minutes', 'hours', 'days', 'weeks'].map((u) => ({ value: u, label: t(`step_properties_editor.units.${u}`) }));
  return (
    <div className="space-y-3">
      <div>
        <Label>{t('step_properties_editor.max_iterations')}</Label>
        <NumberInput value={value?.max_iterations} onChange={(v) => onChange({ ...(value ?? {}), max_iterations: v })} min={1} />
      </div>
      <div>
        <Label>{t('step_properties_editor.loop_delay_amount')}</Label>
        <NumberInput value={value?.waitAmount} onChange={(v) => onChange({ ...(value ?? {}), waitAmount: v })} min={1} />
      </div>
      <div>
        <Label>{t('step_properties_editor.loop_delay_unit')}</Label>
        <Select
          value={value?.waitUnit ?? 'minutes'}
          onChange={(v) => onChange({ ...(value ?? {}), waitUnit: v })}
          options={unitOptions}
        />
      </div>
    </div>
  );
};

const RandomizerEditor: React.FC<{ value: any; onChange: (v: any) => void }> = ({ value, onChange }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-600">
        {t('step_properties_editor.randomizer_description')}
      </p>
      <div>
        <Label>{t('step_properties_editor.branch_weights')}</Label>
        <TextInput
          value={Array.isArray(value?.weights) ? value.weights.join(',') : ''}
          onChange={(v) => onChange({ ...(value ?? {}), weights: v.split(',').map((x) => Number(x.trim())).filter((n) => !Number.isNaN(n)) })}
          placeholder="50, 50"
        />
      </div>
    </div>
  );
};

// ─── Dispatcher ────────────────────────────────────────────────────

export const StepPropertiesEditor: React.FC<Props> = ({ stepType, value, onChange, integrations }) => {
  const { t } = useTranslation();
  switch (stepType) {
    case 'delay':       return <DelayEditor value={value} onChange={onChange} />;
    case 'smart_loop':  return <SmartLoopEditor value={value} onChange={onChange} />;
    case 'randomizer':
    case 'splitter':    return <RandomizerEditor value={value} onChange={onChange} />;
    case 'whatsapp':    return <WhatsAppEditor stepType={stepType} value={value} onChange={onChange} integrations={integrations} />;
    case 'telegram':    return <SimpleChannelEditor stepType={stepType} value={value} onChange={onChange} integrations={integrations} accountKey="telegram_bot_id" accountLabel={t('step_properties_editor.telegram_bot')} accountList={integrations.bots ?? []} />;
    case 'messenger':   return <SimpleChannelEditor stepType={stepType} value={value} onChange={onChange} integrations={integrations} accountKey="messenger_account_id" accountLabel={t('step_properties_editor.fb_page')} accountList={integrations.messenger_apps ?? []} supportsWindow supportsTemplate />;
    case 'instagram':   return <SimpleChannelEditor stepType={stepType} value={value} onChange={onChange} integrations={integrations} accountKey="instagram_account_id" accountLabel={t('step_properties_editor.ig_page')} accountList={integrations.instagram_apps ?? []} supportsWindow />;
    case 'webchat':     return <SimpleChannelEditor stepType={stepType} value={value} onChange={onChange} integrations={integrations} accountKey="wc_instance_id" accountLabel={t('step_properties_editor.webchat_instance')} accountList={integrations.webchat_instances ?? []} />;
    case 'twilio_sms':  return <SimpleChannelEditor stepType={stepType} value={value} onChange={onChange} integrations={integrations} accountKey="twilio_account_id" accountLabel={t('step_properties_editor.twilio_account')} accountList={integrations.twilio_accounts ?? []} />;
    case 'twilio_call': return <SimpleChannelEditor stepType={stepType} value={value} onChange={onChange} integrations={integrations} accountKey="twilio_account_id" accountLabel={t('step_properties_editor.twilio_account')} accountList={integrations.twilio_accounts ?? []} />;
    case 'zapi':        return <SimpleChannelEditor stepType={stepType} value={value} onChange={onChange} integrations={integrations} accountKey="zapi_instance_id" accountLabel={t('step_properties_editor.zapi_instance')} accountList={integrations.zapi_instances ?? []} />;
    case 'evolution':   return <SimpleChannelEditor stepType={stepType} value={value} onChange={onChange} integrations={integrations} accountKey="evolution_instance_id" accountLabel={t('step_properties_editor.evolution_instance')} accountList={integrations.evolution_instances ?? []} />;
    case 'email':       return (
      <div className="space-y-3">
        <div><Label>{t('step_properties_editor.subject')}</Label><TextInput value={value?.subject} onChange={(v) => onChange({ ...(value ?? {}), subject: v })} /></div>
        <div><Label>{t('step_properties_editor.body')}</Label><TextArea value={value?.text} onChange={(v) => onChange({ ...(value ?? {}), text: v })} /></div>
      </div>
    );
    default:
      return <div className="p-3 text-xs text-gray-500">{t('step_properties_editor.no_editor_for_step_type')} <code>{stepType}</code>.</div>;
  }
};
