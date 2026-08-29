import React, { useState } from 'react';
import { getUserInfo } from "@/lib/auth";
import { Shield, Plus, Archive, RotateCcw, Pencil, ShieldCheck, ShieldOff, Sparkles, Lock, Trash2, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import AddRoleForm from "./AddRoleForm";
import { useTranslation } from 'react-i18next';

const ROW_ACCENTS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
  'bg-indigo-500', 'bg-teal-500',
];

const AgencyRoles = () => {
  const { mode } = useTheme();
  const { t } = useTranslation();
  const dark = mode === 'dark';
  const [viewMode, setViewMode] = useState<'LIST' | 'ADD' | 'EDIT'>('LIST');
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [search, setSearch] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userInfo = getUserInfo();
  const agencyId = userInfo.modelable_id;

  const { data: rolesResponse, isLoading } = useQuery({
    queryKey: [`/api/organizations/${agencyId}/roles`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${agencyId}/roles`);
      return res.json();
    },
  });

  const { data: permGroups = [] } = useQuery<any[]>({
    queryKey: [`/api/organizations/${agencyId}/permissions`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/organizations/${agencyId}/permissions`);
      return res.json();
    },
    enabled: !!agencyId,
  });
  const totalAgencyPerms = permGroups.reduce((sum: number, g: any) => sum + (g.children?.length || 0), 0);

  const rolesKey = [`/api/organizations/${agencyId}/roles`];

  const toggleArchiveMutation = useMutation({
    mutationFn: async (role: any) => {
      const res = await apiRequest("PATCH", `/api/organizations/${agencyId}/roles/${role.id}`, {
        status: role.status === 'ACTIVE' ? 'ARCHIVE' : 'ACTIVE',
      });
      return res.json();
    },
    // Optimistic: flip the role's status in the cache the instant it's clicked so
    // it jumps between the Active/Archived tabs immediately — the user never waits
    // on the (remote-DB) round-trip. Roll back if the server rejects it.
    onMutate: async (role: any) => {
      const newStatus = role.status === 'ACTIVE' ? 'ARCHIVE' : 'ACTIVE';
      await queryClient.cancelQueries({ queryKey: rolesKey });
      const previous = queryClient.getQueryData(rolesKey);
      queryClient.setQueryData(rolesKey, (old: any) => {
        if (!old?.roles) return old;
        return {
          ...old,
          roles: old.roles.map((r: any) =>
            r.id === role.id ? { ...r, status: newStatus } : r,
          ),
        };
      });
      // Toast right away too — the action is effectively done from the user's view.
      toast({ title: role.status === 'ACTIVE' ? 'Role Archived' : 'Role Restored' });
      return { previous };
    },
    onError: (_err, _role, context: any) => {
      // Revert the optimistic change if the server call failed.
      if (context?.previous) queryClient.setQueryData(rolesKey, context.previous);
      toast({ title: 'Could not update role', description: 'Please try again.', variant: 'destructive' });
    },
  });

  // Permanent — unlike archive (reversible), this actually removes the role,
  // its permission links, and unassigns it from any agent (backend: roles.service.ts deleteRole).
  const deleteRoleMutation = useMutation({
    mutationFn: async (role: any) => {
      const res = await apiRequest("DELETE", `/api/organizations/${agencyId}/roles/${role.id}`);
      return res.json();
    },
    onSuccess: (_data, role: any) => {
      queryClient.setQueryData(rolesKey, (old: any) => {
        if (!old?.roles) return old;
        return { ...old, roles: old.roles.filter((r: any) => r.id !== role.id) };
      });
      toast({ title: 'Role Deleted' });
    },
    onError: () => {
      toast({ title: 'Could not delete role', description: 'Please try again.', variant: 'destructive' });
    },
  });

  const rawRoles = rolesResponse?.roles || [];
  const displayRoles = React.useMemo(() => {
    const q = search.toLowerCase();
    const filteredByTab = rawRoles.filter((r: any) => 
      activeTab === 'active' ? r.status === 'ACTIVE' : r.status === 'ARCHIVE'
    );
    return filteredByTab.filter((r: any) => 
      !q || 
      r.name?.toLowerCase().includes(q) || 
      r.description?.toLowerCase().includes(q)
    );
  }, [rawRoles, activeTab, search]);

  const activeRolesCount = rawRoles.filter((r: any) => r.status === 'ACTIVE').length;
  const archivedRolesCount = rawRoles.filter((r: any) => r.status === 'ARCHIVE').length;

  if (viewMode === 'ADD' || viewMode === 'EDIT') {
    return (
      <AddRoleForm
        onCancel={() => { setViewMode('LIST'); setSelectedRole(null); }}
        initialData={selectedRole}
      />
    );
  }

  const bg = dark ? 'bg-[#0b1120]' : 'bg-slate-50/80';
  const card = dark ? 'bg-[#0f1829]' : 'bg-white';
  const border = dark ? 'border-slate-800' : 'border-slate-200';
  const text = dark ? 'text-white' : 'text-slate-900';
  const sub = dark ? 'text-slate-500' : 'text-slate-400';

  return (
    <div className={cn('min-h-screen transition-colors', bg)}>

      {/* ── Header ── */}
      <div className={cn('px-8 py-5 border-b flex items-center justify-between', card, border)}>
        <div className="flex items-center gap-4">
          <div className={cn('p-2.5 rounded-xl', dark ? 'bg-primary/15' : 'bg-primary/10')}>
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className={cn('text-[15px] font-bold', text)}>{t('nav.roles')}</h1>
            <p className={cn('text-[11px] mt-0.5', sub)}>
              {activeRolesCount} active · {archivedRolesCount} archived
            </p>
          </div>
        </div>
        <button
          onClick={() => { setSelectedRole(null); setViewMode('ADD'); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold bg-primary hover:opacity-90 text-primary-foreground transition-colors shadow-sm"
        >
          <Plus size={14} /> {t('agency.roles.add')}
        </button>
      </div>

      {/* ── Search bar ── */}
      <div className={cn('px-8 py-3 border-b flex items-center justify-between gap-4', card, border)}>
        <div className="relative max-w-xs flex-1">
          <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5", sub)} />
          <input
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "pl-9 pr-3 h-8 w-full text-[12px] rounded-lg border outline-none transition-colors",
              dark
                ? "bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-slate-600"
                : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-300"
            )}
          />
        </div>
        <div className="flex items-center gap-1">
          {([
            { key: 'active', label: t('common.active'), icon: <ShieldCheck size={13} />, count: activeRolesCount },
            { key: 'archived', label: t('common.archived'), icon: <ShieldOff size={13} />, count: archivedRolesCount },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors',
                activeTab === tab.key
                  ? 'bg-primary/10 text-primary'
                  : cn(sub, 'hover:text-slate-300')
              )}
            >
              {tab.icon}
              {tab.label}
              <span className={cn(
                'ml-0.5 min-w-[18px] text-center text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                activeTab === tab.key
                  ? 'bg-primary/10 text-primary'
                  : dark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Table area ── */}
      <div className="px-8 py-6">
        <div className={cn('rounded-xl border overflow-hidden', card, border)}>

          {/* Column headers */}
          {!isLoading && displayRoles.length > 0 && (
            <div className={cn(
              'grid items-center px-6 py-3 text-[11px] font-bold uppercase tracking-wider border-b',
              dark ? 'text-slate-500 border-slate-800 bg-slate-900/30' : 'text-slate-500 border-slate-100 bg-slate-50/50'
            )}
              style={{ gridTemplateColumns: '4.5rem 1fr 8rem 8rem 8rem 8rem' }}
            >
              <span />
              <span>Role</span>
              <span className="text-center">Permissions</span>
              <span className="text-center">Type</span>
              <span className="text-center">Status</span>
              <span className="text-right pr-4">Actions</span>
            </div>
          )}

          {/* Rows */}
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn('flex items-center gap-4 px-5 py-4 border-b last:border-0 animate-pulse', border)}>
                <div className={cn('w-1.5 h-8 rounded-full', dark ? 'bg-slate-800' : 'bg-slate-200')} />
                <div className="flex-1 space-y-2">
                  <div className={cn('h-3 w-40 rounded', dark ? 'bg-slate-800' : 'bg-slate-200')} />
                  <div className={cn('h-2 w-64 rounded', dark ? 'bg-slate-800/60' : 'bg-slate-100')} />
                </div>
                <div className={cn('h-6 w-24 rounded-full', dark ? 'bg-slate-800' : 'bg-slate-100')} />
                <div className={cn('h-6 w-16 rounded-full', dark ? 'bg-slate-800' : 'bg-slate-100')} />
                <div className={cn('h-6 w-16 rounded-full', dark ? 'bg-slate-800' : 'bg-slate-100')} />
              </div>
            ))
          ) : displayRoles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-4', dark ? 'bg-slate-800' : 'bg-slate-100')}>
                <Shield className="w-6 h-6 text-slate-400" />
              </div>
              <p className={cn('text-[13px] font-bold mb-1', text)}>
                {activeTab === 'active' ? t('agency.roles.empty') : t('agency.roles.empty')}
              </p>
              <p className={cn('text-[12px]', sub)}>
                {activeTab === 'active' ? t('agency.roles.emptyActive') : t('agency.roles.emptyArchived')}
              </p>
            </div>
          ) : (
            displayRoles.map((role: any, i: number) => {
              const accent = ROW_ACCENTS[i % ROW_ACCENTS.length];
              const permCount = role.permissions?.length || 0;
              const maxPerms = totalAgencyPerms || 12;
              const pct = Math.min((permCount / maxPerms) * 100, 100);
              return (
                <div
                  key={role.id}
                  className={cn(
                    'group grid items-center px-6 py-3.5 border-b last:border-0 transition-colors',
                    dark ? 'border-slate-800 hover:bg-slate-800/40' : 'border-slate-100 hover:bg-slate-50/50'
                  )}
                  style={{ gridTemplateColumns: '4.5rem 1fr 8rem 8rem 8rem 8rem' }}
                >
                  {/* Icon Container */}
                  <div className="flex items-center">
                    <div className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm',
                      accent.replace('bg-', 'bg-').replace('500', '500/10'),
                      'border border-current/5'
                    )}>
                      {/* Role's chosen FontAwesome icon (replyagent parity); falls back
                          to a shield icon for older rows that have no icon stored. */}
                      <i className={cn('fa-solid text-[15px]', role.icon || 'fa-user-shield', accent.replace('bg-', 'text-'))} />
                    </div>
                  </div>

                  {/* Name + description */}
                  <div className="min-w-0 pr-4">
                    <p className={cn('text-[14px] font-bold tracking-tight', text)}>{role.name}</p>
                    {role.description && (
                      <p className={cn('text-[11px] font-medium mt-0.5 truncate max-w-[400px]', dark ? 'text-slate-500' : 'text-slate-400')}>
                        {role.description}
                      </p>
                    )}
                  </div>

                  {/* Permissions count */}
                  <div className="text-center">
                    <span className={cn('text-[13px] font-bold tabular-nums', text)}>
                      {permCount}
                    </span>
                  </div>

                  {/* Type Badge */}
                  <div className="flex justify-center">
                    {role.isSystem ? (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200/50">
                        System
                      </span>
                    ) : (
                      <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-lg border',
                        dark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-blue-50 border-blue-100 text-blue-600')}>
                        Custom
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="flex justify-center">
                    <span className={cn(
                      'inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-lg',
                      role.status === 'ACTIVE'
                        ? 'text-slate-700 bg-white dark:text-emerald-400 dark:bg-emerald-500/10'
                        : dark ? 'text-slate-500 bg-slate-800' : 'text-slate-500 bg-slate-100'
                    )}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', role.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400')} />
                      {role.status === 'ACTIVE' ? t('common.active') : t('common.archived')}
                    </span>
                  </div>

                  {/* Actions Buttons */}
                  <div className="flex items-center justify-end gap-2 pr-4">
                    {!role.isSystem && activeTab === 'active' && (
                      <button
                        onClick={() => { setSelectedRole(role); setViewMode('EDIT'); }}
                        className={cn(
                          'p-1.5 rounded-lg border transition-all shadow-sm',
                          dark 
                            ? 'border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white' 
                            : 'border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-900'
                        )}
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    {!role.isSystem && (
                      <button
                        onClick={() => toggleArchiveMutation.mutate(role)}
                        title={activeTab === 'active' ? t('common.archive', { defaultValue: 'Archive' }) : t('common.restore', { defaultValue: 'Restore' })}
                        className={cn(
                          'p-1.5 rounded-lg border transition-all shadow-sm',
                          activeTab === 'active'
                            ? dark
                              ? 'border-slate-700 hover:bg-amber-500/10 text-slate-500 hover:text-amber-400'
                              : 'border-slate-200 hover:bg-amber-50 text-slate-400 hover:text-amber-600'
                            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                        )}
                      >
                        {activeTab === 'active' ? <Archive size={13} /> : <RotateCcw size={13} />}
                      </button>
                    )}
                    {!role.isSystem && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete role "${role.name}"? This cannot be undone — any agent assigned to it will lose that role.`)) {
                            deleteRoleMutation.mutate(role);
                          }
                        }}
                        title="Delete"
                        className={cn(
                          'p-1.5 rounded-lg border transition-all shadow-sm',
                          dark
                            ? 'border-slate-700 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400'
                            : 'border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                        )}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default AgencyRoles;
