'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Calendar,
  Search,
  RefreshCw,
  UserCheck,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Shield,
  MapPin,
  Clock,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Guard {
  id: string;
  fullName: string;
  nin: string;
  status: string;
  currentShift: string;
  assignedSite?: { id: string; name: string } | null;
}

interface Site {
  id: string;
  name: string;
  address: string;
}

const SHIFTS = ['DAY', 'NIGHT', 'SWING'];

const shiftColors: Record<string, string> = {
  DAY: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  NIGHT: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  SWING: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
};

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  ON_LEAVE: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  SUSPENDED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

export default function SchedulePage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [transferModal, setTransferModal] = useState<Guard | null>(null);
  const [targetSiteId, setTargetSiteId] = useState('');
  const [targetShift, setTargetShift] = useState('DAY');
  const [transferNotes, setTransferNotes] = useState('');

  // Fetch guards
  const { data: guardsData, isLoading: guardsLoading } = useQuery({
    queryKey: ['guards-schedule', page, search, shiftFilter],
    queryFn: async () => {
      const res = await api.get('/guards', {
        params: {
          page,
          limit: 12,
          search: search || undefined,
          status: 'ACTIVE',
        },
      });
      return res.data;
    },
  });

  // Fetch sites for transfer target dropdown
  const { data: sitesData } = useQuery({
    queryKey: ['sites-list'],
    queryFn: async () => {
      const res = await api.get('/sites', { params: { limit: 100 } });
      return res.data;
    },
  });

  // Transfer / reassign mutation
  const { mutate: transferGuard, isPending: transferring } = useMutation({
    mutationFn: async ({
      guardId,
      siteId,
      shift,
      notes,
    }: {
      guardId: string;
      siteId: string;
      shift: string;
      notes: string;
    }) => {
      await api.post(`/guards/${guardId}/transfer`, {
        newSiteId: siteId,
        newShift: shift,
        reason: notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guards-schedule'] });
      setTransferModal(null);
      setTargetSiteId('');
      setTransferNotes('');
    },
  });

  const guards: Guard[] = guardsData?.data ?? [];
  const meta = guardsData?.meta;
  const sites: Site[] = sitesData?.data ?? [];

  const filteredGuards = shiftFilter
    ? guards.filter((g) => g.currentShift === shiftFilter)
    : guards;

  const openTransfer = (guard: Guard) => {
    setTransferModal(guard);
    setTargetSiteId(guard.assignedSite?.id ?? '');
    setTargetShift(guard.currentShift ?? 'DAY');
    setTransferNotes('');
  };

  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" /> Shift Schedule
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View active guard rosters, manage shift assignments, and reassign personnel.
          </p>
        </div>
        {/* Shift filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShiftFilter('')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
              shiftFilter === ''
                ? 'bg-primary/20 text-primary border-primary/40'
                : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
            )}
          >
            All Shifts
          </button>
          {SHIFTS.map((s) => (
            <button
              key={s}
              onClick={() => setShiftFilter(s === shiftFilter ? '' : s)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                shiftFilter === s
                  ? shiftColors[s]
                  : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {SHIFTS.map((shift) => {
          const count = guards.filter((g) => g.currentShift === shift).length;
          return (
            <div
              key={shift}
              className="rounded-xl border border-border bg-card p-4 flex items-center gap-3"
            >
              <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', shiftColors[shift])}>
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground">{shift} Shift</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main table card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Search toolbar */}
        <div className="p-4 border-b border-border flex items-center gap-3 bg-secondary/20">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search guard name or NIN..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>
          <span className="text-xs text-muted-foreground ml-auto">
            {meta?.total ?? '—'} guards total
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-medium tracking-wider">Guard</th>
                <th className="px-6 py-4 font-medium tracking-wider">Assigned Site</th>
                <th className="px-6 py-4 font-medium tracking-wider">Shift</th>
                <th className="px-6 py-4 font-medium tracking-wider">Status</th>
                <th className="px-6 py-4 font-medium tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {guardsLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Loading schedule data...
                    </div>
                  </td>
                </tr>
              ) : filteredGuards.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No guards found matching your criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredGuards.map((guard) => (
                  <tr key={guard.id} className="hover:bg-secondary/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          {guard.fullName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                            {guard.fullName}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">{guard.nin}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {guard.assignedSite ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-foreground">{guard.assignedSite.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider',
                          shiftColors[guard.currentShift] ?? 'bg-secondary text-muted-foreground'
                        )}
                      >
                        {guard.currentShift ?? '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider',
                          statusColors[guard.status] ?? 'bg-secondary text-muted-foreground'
                        )}
                      >
                        {guard.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        id={`reassign-${guard.id}`}
                        onClick={() => openTransfer(guard)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-all"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        Reassign
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && (
          <div className="border-t border-border p-4 flex items-center justify-between bg-secondary/10">
            <span className="text-xs text-muted-foreground">
              Showing <span className="font-medium text-foreground">{filteredGuards.length}</span>{' '}
              of <span className="font-medium text-foreground">{meta.total}</span> entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-medium px-2 text-foreground">
                Page {page} of {meta.pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
                disabled={page >= meta.pages}
                className="p-1.5 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transfer / Reassign Modal */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-primary" />
                  Reassign Guard
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {transferModal.fullName}
                </p>
              </div>
              <button
                onClick={() => setTransferModal(null)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-secondary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-5 space-y-4">
              {/* Target site */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Assign to Site
                </label>
                <select
                  id="transfer-site-select"
                  value={targetSiteId}
                  onChange={(e) => setTargetSiteId(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                >
                  <option value="">— Select site —</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shift */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Shift
                </label>
                <div className="flex gap-2">
                  {SHIFTS.map((s) => (
                    <button
                      key={s}
                      id={`shift-${s.toLowerCase()}`}
                      onClick={() => setTargetShift(s)}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-xs font-semibold border transition-all',
                        targetShift === s
                          ? shiftColors[s]
                          : 'border-border text-muted-foreground hover:border-primary/30'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Reason / Notes
                </label>
                <textarea
                  id="transfer-notes"
                  rows={3}
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="e.g. Guard replacement due to leave request..."
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-5 pb-5">
              <button
                onClick={() => setTransferModal(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-border hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                id="confirm-transfer-btn"
                disabled={!targetSiteId || transferring}
                onClick={() =>
                  transferGuard({
                    guardId: transferModal.id,
                    siteId: targetSiteId,
                    shift: targetShift,
                    notes: transferNotes,
                  })
                }
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-[0_0_12px_rgba(139,92,246,0.25)]',
                  !targetSiteId || transferring
                    ? 'bg-primary/40 text-primary-foreground/60 cursor-not-allowed'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {transferring ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <UserCheck className="h-3.5 w-3.5" /> Confirm Reassignment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
