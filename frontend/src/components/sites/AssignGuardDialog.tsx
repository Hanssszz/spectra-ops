'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { X, Search, Shield, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssignGuardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  site: { id: string; name: string } | null;
}

interface Guard {
  id: string;
  fullName: string;
  nin: string;
  status: string;
  currentShift: string;
  assignedSite?: { id: string; name: string };
}

export default function AssignGuardDialog({ isOpen, onClose, site }: AssignGuardDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedGuardId, setSelectedGuardId] = useState<string | null>(null);

  // Fetch all guards for assignment
  const { data: guardsData, isLoading } = useQuery({
    queryKey: ['guards-for-assign'],
    queryFn: async () => {
      const res = await api.get('/guards', { params: { limit: 100 } });
      return res.data;
    },
    enabled: isOpen,
  });

  // Mutate to assign the guard
  const assignMutation = useMutation({
    mutationFn: async ({ guardId, siteId }: { guardId: string; siteId: string }) => {
      return api.post(`/guards/${guardId}/transfer`, { newSiteId: siteId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      queryClient.invalidateQueries({ queryKey: ['guards'] });
      queryClient.invalidateQueries({ queryKey: ['guards-for-assign'] });
      setSelectedGuardId(null);
      onClose();
    },
    onError: (err) => {
      console.error(err);
      alert('Failed to assign guard to this site. Please try again.');
    },
  });

  if (!isOpen || !site) return null;

  const guards: Guard[] = guardsData?.data || [];
  
  // Filter guards based on search input
  const filteredGuards = guards.filter(guard =>
    guard.fullName.toLowerCase().includes(search.toLowerCase()) ||
    guard.nin.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssign = () => {
    if (!selectedGuardId) return;
    assignMutation.mutate({ guardId: selectedGuardId, siteId: site.id });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4 bg-secondary/10">
          <div>
            <h2 className="text-lg font-bold text-foreground">Assign Guard</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Deploy personnel to <span className="font-semibold text-primary">{site.name}</span></p>
          </div>
          <button 
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border bg-secondary/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search guard by name or NIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>
        </div>

        {/* Guards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[200px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground text-sm">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading security personnel...
            </div>
          ) : filteredGuards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
              <Shield className="h-10 w-10 opacity-20 mb-2" />
              No guards found.
            </div>
          ) : (
            filteredGuards.map((guard) => {
              const isSelected = selectedGuardId === guard.id;
              const isAlreadyAtSite = guard.assignedSite?.id === site.id;

              return (
                <div
                  key={guard.id}
                  onClick={() => {
                    if (!isAlreadyAtSite) {
                      setSelectedGuardId(isSelected ? null : guard.id);
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none",
                    isAlreadyAtSite 
                      ? "bg-emerald-500/5 border-emerald-500/20 opacity-80 cursor-not-allowed" 
                      : isSelected 
                      ? "bg-primary/10 border-primary shadow-sm" 
                      : "bg-card border-border hover:bg-secondary/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                      isAlreadyAtSite ? "bg-emerald-500/20 text-emerald-500" : "bg-primary/20 text-primary"
                    )}>
                      {guard.fullName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">{guard.fullName}</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Shift: <span className="font-medium text-foreground">{guard.currentShift}</span>
                        {guard.assignedSite ? (
                          <>
                            {' • '}
                            <span>Currently at: <span className="font-medium text-foreground">{guard.assignedSite.name}</span></span>
                          </>
                        ) : (
                          <>
                            {' • '}
                            <span className="text-amber-500 font-medium">Unassigned</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {isAlreadyAtSite ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                      <CheckCircle2 className="h-4 w-4" /> Deployed
                    </div>
                  ) : (
                    <div className={cn(
                      "h-5 w-5 rounded-full border flex items-center justify-center transition-all",
                      isSelected ? "border-primary bg-primary text-white" : "border-muted-foreground/30 bg-background"
                    )}>
                      {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-white" />}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 bg-secondary/15 flex items-center justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleAssign}
            disabled={!selectedGuardId || assignMutation.isPending}
            className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {assignMutation.isPending && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            Deploy Personnel
          </button>
        </div>
      </div>
    </div>
  );
}
