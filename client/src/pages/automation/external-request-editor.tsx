/**
 * ExternalRequestEditor — replyagent parity for
 * `gateway-frontend/src/components/automation/actions/ExternalRequest.vue`.
 *
 * Replyagent renders FOUR tabs (Headers / Body / Response / Mapping) plus a
 * "Test" button that fires the request live, captures the response, and lets
 * the user wire response paths into custom fields via the Mapping tab.
 *
 * Shape of `value`:
 *   {
 *     method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
 *     url: string,
 *     headers: Array<{ key, value }>,
 *     body_type: 'json' | 'form',
 *     body_json: string,
 *     body_form: Array<{ key, value }>,
 *     last_response: { status: number, body: any } | null,
 *     mappings: Array<{ json_path, field_id }>,
 *   }
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Play, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { FieldPicker } from './pickers';

type TabKey = 'headers' | 'body' | 'response' | 'mapping';

interface KV {
  key: string;
  value: string;
}
interface Mapping {
  json_path: string;
  field_id: string;
}

export function ExternalRequestEditor({
  value,
  onChange,
}: {
  value: any;
  onChange: (next: any) => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>('headers');
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const TAB_LABELS: Record<TabKey, string> = {
    headers: t('external_request_editor.tabs.headers'),
    body: t('external_request_editor.tabs.body'),
    response: t('external_request_editor.tabs.response'),
    mapping: t('external_request_editor.tabs.mapping'),
  };

  const v = value ?? {};
  const headers: KV[] = Array.isArray(v.headers) ? v.headers : [];
  const bodyType: 'json' | 'form' = v.body_type ?? 'json';
  const bodyForm: KV[] = Array.isArray(v.body_form) ? v.body_form : [];
  const mappings: Mapping[] = Array.isArray(v.mappings) ? v.mappings : [];
  const lastResponse = v.last_response ?? null;

  const set = (partial: Record<string, any>) => onChange({ ...v, ...partial });

  const runTest = async () => {
    if (!v.url) {
      toast({ title: t('external_request_editor.url_required'), variant: 'destructive' });
      return;
    }
    setTesting(true);
    try {
      const res = await apiRequest('POST', '/api/automations/test-http', {
        method: v.method ?? 'GET',
        url: v.url,
        headers: headers.reduce(
          (acc: Record<string, string>, h) => (h.key ? { ...acc, [h.key]: h.value } : acc),
          {},
        ),
        body:
          bodyType === 'json'
            ? v.body_json
              ? safeParseJson(v.body_json)
              : null
            : bodyForm.reduce(
                (acc: Record<string, string>, h) => (h.key ? { ...acc, [h.key]: h.value } : acc),
                {},
              ),
      });
      const json = await res.json();
      set({
        last_response: {
          status: json.status ?? res.status,
          body: json.body ?? json,
        },
      });
      setTab('response');
      toast({ title: t('external_request_editor.response_status', { status: json.status ?? res.status }) });
    } catch (err: any) {
      toast({
        title: t('external_request_editor.test_failed'),
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Method + URL row + Test button */}
      <div className="flex items-stretch gap-2">
        <Select
          value={v.method ?? 'GET'}
          onValueChange={(m) => set({ method: m })}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={v.url ?? ''}
          onChange={(e) => set({ url: e.target.value })}
          placeholder={t('external_request_editor.url_placeholder')}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={testing || !v.url}
          onClick={runTest}
        >
          {testing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          <span className="ml-1">{t('external_request_editor.test_button')}</span>
        </Button>
      </div>

      {/* Tabs strip */}
      <div className="flex border-b">
        {(['headers', 'body', 'response', 'mapping'] as TabKey[]).map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setTab(tabKey)}
            className={`px-3 py-2 text-xs capitalize border-b-2 ${
              tab === tabKey
                ? 'border-emerald-500 text-emerald-700 font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {TAB_LABELS[tabKey]}
            {tabKey === 'response' && lastResponse && (
              <Badge variant="outline" className="ml-1 h-4 text-[9px]">
                {lastResponse.status}
              </Badge>
            )}
            {tabKey === 'mapping' && mappings.length > 0 && (
              <Badge variant="outline" className="ml-1 h-4 text-[9px]">
                {mappings.length}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {tab === 'headers' && (
        <KvBuilder
          rows={headers}
          onChange={(next) => set({ headers: next })}
          keyPlaceholder="Authorization"
          valuePlaceholder="Bearer …"
        />
      )}

      {tab === 'body' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs">{t('external_request_editor.body_type_label')}</Label>
            <Select
              value={bodyType}
              onValueChange={(nextType: 'json' | 'form') => set({ body_type: nextType })}
            >
              <SelectTrigger className="w-32 h-7">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">{t('external_request_editor.body_type_json')}</SelectItem>
                <SelectItem value="form">{t('external_request_editor.body_type_form')}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <FieldPicker
              onInsert={(token) => {
                if (bodyType === 'json') {
                  set({ body_json: (v.body_json ?? '') + token });
                }
              }}
              buttonLabel="{{ var }}"
            />
          </div>
          {bodyType === 'json' ? (
            <Textarea
              value={v.body_json ?? ''}
              onChange={(e) => set({ body_json: e.target.value })}
              rows={8}
              placeholder='{ "key": "value" }'
              className="font-mono text-xs"
            />
          ) : (
            <KvBuilder
              rows={bodyForm}
              onChange={(next) => set({ body_form: next })}
              keyPlaceholder="field_name"
              valuePlaceholder="value"
            />
          )}
        </div>
      )}

      {tab === 'response' && (
        <div className="space-y-2">
          {lastResponse ? (
            <>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    lastResponse.status >= 200 && lastResponse.status < 300
                      ? 'border-emerald-500 text-emerald-700'
                      : 'border-destructive text-destructive'
                  }
                >
                  {t('external_request_editor.status_label', { status: lastResponse.status })}
                </Badge>
              </div>
              <pre className="bg-muted/40 rounded p-2 text-[10px] overflow-auto max-h-64 font-mono whitespace-pre-wrap">
                {typeof lastResponse.body === 'string'
                  ? lastResponse.body
                  : JSON.stringify(lastResponse.body, null, 2)}
              </pre>
              <p className="text-[10px] text-muted-foreground">
                {t('external_request_editor.mapping_hint_prefix')}{' '}
                <span className="font-medium">{t('external_request_editor.tabs.mapping')}</span>{' '}
                {t('external_request_editor.mapping_hint_suffix')}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-6">
              {t('external_request_editor.empty_response_prefix')}{' '}
              <span className="font-medium">{t('external_request_editor.test_button')}</span>{' '}
              {t('external_request_editor.empty_response_suffix')}
            </p>
          )}
        </div>
      )}

      {tab === 'mapping' && (
        <MappingBuilder
          rows={mappings}
          onChange={(next) => set({ mappings: next })}
        />
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function KvBuilder({
  rows,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
}: {
  rows: KV[];
  onChange: (next: KV[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const { t } = useTranslation();
  const update = (i: number, partial: Partial<KV>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...partial } : r)));
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, { key: '', value: '' }]);

  return (
    <div className="space-y-1">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1">
          <Input
            value={r.key}
            onChange={(e) => update(i, { key: e.target.value })}
            placeholder={keyPlaceholder}
            className="h-7 text-xs flex-1"
          />
          <Input
            value={r.value}
            onChange={(e) => update(i, { value: e.target.value })}
            placeholder={valuePlaceholder}
            className="h-7 text-xs flex-[2]"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => remove(i)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="h-7 text-xs"
      >
        <Plus className="h-3 w-3 mr-1" /> {t('external_request_editor.add_row')}
      </Button>
    </div>
  );
}

function MappingBuilder({
  rows,
  onChange,
}: {
  rows: Mapping[];
  onChange: (next: Mapping[]) => void;
}) {
  const { t } = useTranslation();
  const update = (i: number, partial: Partial<Mapping>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...partial } : r)));
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, { json_path: '', field_id: '' }]);

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-muted-foreground">
        {t('external_request_editor.json_path_hint_prefix')}{' '}
        <code className="font-mono">data.user.email</code>{' '}
        {t('external_request_editor.json_path_hint_suffix')}
      </p>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1">
          <Input
            value={r.json_path}
            onChange={(e) => update(i, { json_path: e.target.value })}
            placeholder="data.user.email"
            className="h-7 text-xs flex-1 font-mono"
          />
          <Input
            value={r.field_id}
            onChange={(e) => update(i, { field_id: e.target.value })}
            placeholder={t('external_request_editor.field_id_placeholder')}
            className="h-7 text-xs flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => remove(i)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="h-7 text-xs"
      >
        <Plus className="h-3 w-3 mr-1" /> {t('external_request_editor.add_mapping')}
      </Button>
    </div>
  );
}

function safeParseJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
