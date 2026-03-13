'use client';

import { useState, useEffect } from 'react';
import { MatriculaInput } from '@/components/MatriculaInput';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { DailyRecordsTable } from '@/components/dashboard/DailyRecordsTable';
import { PreviousBalanceDialog } from '@/components/PreviousBalanceDialog';
import { DsrSettingsDialog } from '@/components/DsrSettingsDialog';
import { EditTimesDialog } from '@/components/EditTimesDialog';
import { CalendarViewDialog } from '@/components/CalendarViewDialog';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { ThemeToggle } from '@/components/ThemeToggle';
import { fetchMonthData } from '@/actions/ponto-actions';
import { getUserProfile, saveUserProfile, getMonthlyEntries, saveDailyEntriesBatch, saveSingleEntry } from '@/actions/db-actions';
import { Button } from '@/components/ui/button';
import { RefreshCcw, LogOut, Loader2, Calendar, Settings, Wallet, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { normalizeNightShifts } from '@/lib/ponto-utils';

export type DailyRecord = {
  id: string;
  date: string;
  times: string[];
  monthlyTimeLogId?: string;
  isManualDsr?: boolean; 
  isManualWork?: boolean;
  isHoliday?: boolean;
  isCompensation?: boolean;
  isBankOff?: boolean;
};

export type EmployeeData = {
  id: string;
  matricula: string;
  previousBalance: string;
  previousBalanceMonth?: number;
  previousBalanceYear?: number;
  balanceAdjustment?: string;
  previousHolidayBalance: number;
  lastFetch: string;
  fixedDsrDays: number[];
  referenceDsrSunday?: string | null;
  dailyWorkload: number;
  holidays: string[];
  dailyRecords: DailyRecord[];
  isAdmin?: boolean;
  uid?: string;
  authVersion?: number;
};

export default function PontoDashboard() {
  const [matricula, setMatricula] = useState<string | null>(null);
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMonth, setViewMonth] = useState<number | null>(null);
  const [viewYear, setViewYear] = useState<number | null>(null);
  
  const [showBalanceDialog, setShowBalanceDialog] = useState(false);
  const [showDsrDialog, setShowDsrDialog] = useState(false);
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DailyRecord | null>(null);
  
  const [isUserLoading, setIsUserLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    if (viewMonth === null) setViewMonth(now.getMonth() + 1);
    if (viewYear === null) setViewYear(now.getFullYear());
    setIsUserLoading(false);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('logged_matricula');
    if (saved && !isUserLoading && viewMonth !== null && viewYear !== null) {
      setMatricula(saved);
      loadEmployeeData(saved, viewMonth, viewYear);
    }
  }, [isUserLoading, viewMonth, viewYear]);

  const loadEmployeeData = async (m: string, month: number, year: number) => {
    setIsLoading(true);
    try {
      let base = await getUserProfile(m) || { isAdmin: m === '000000' } as any;

      const rawRecords = await getMonthlyEntries(m, month, year);
      const mappedRecords = rawRecords.map((r: any) => ({
        ...r,
        id: r.id.replace(`${m}_`, ''),
      })) as DailyRecord[];
      
      const daysInMonth = new Date(year, month, 0).getDate();
      
      const fullMonthRecords: DailyRecord[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${d.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
        const existing = mappedRecords.find(r => r.date === dateStr);
        if (existing) {
          fullMonthRecords.push(existing);
        } else {
          fullMonthRecords.push({
            id: dateStr.replace(/\//g, ''),
            date: dateStr,
            times: []
          });
        }
      }

      setEmployeeData({
        id: m,
        matricula: m,
        previousBalance: base?.previousBalance || '00:00',
        previousBalanceMonth: base?.previousBalanceMonth,
        previousBalanceYear: base?.previousBalanceYear,
        balanceAdjustment: base?.balanceAdjustment || '00:00',
        previousHolidayBalance: base?.previousHolidayBalance || 0,
        fixedDsrDays: base?.fixedDsrDays ? JSON.parse(base.fixedDsrDays) : [0],
        referenceDsrSunday: base?.referenceDsrSunday,
        dailyWorkload: base?.dailyWorkload || 440,
        holidays: base?.holidays ? JSON.parse(base.holidays) : [],
        lastFetch: base?.updatedAt || new Date().toISOString(),
        dailyRecords: fullMonthRecords,
        isAdmin: base?.isAdmin || m === '000000',
        uid: base?.uid,
        authVersion: base?.authVersion
      });
    } catch (e) {
      console.error("Error loading data:", e);
      toast({ variant: "destructive", title: "Erro ao carregar dados" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('logged_matricula');
    setMatricula(null);
    setEmployeeData(null);
  };

  const handlePrevMonth = () => {
    if (!viewMonth || !viewYear) return;
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (!viewMonth || !viewYear) return;
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  if (!matricula) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <MatriculaInput onLogin={(m) => {
          setMatricula(m);
          localStorage.setItem('logged_matricula', m);
          if (viewMonth && viewYear) loadEmployeeData(m, viewMonth, viewYear);
        }} />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="flex flex-col gap-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card p-6 rounded-3xl border border-border/50 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-foreground">PONTO ÁGIL</h1>
                <p className="text-sm text-muted-foreground font-medium">Gestão de Banco de Horas</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center bg-muted/50 rounded-2xl p-1 border border-border/50">
                <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="rounded-xl h-9 w-9">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="px-4 text-sm font-black uppercase min-w-[140px] text-center">
                  {viewMonth && viewYear && new Date(viewYear, viewMonth - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                </div>
                <Button variant="ghost" size="icon" onClick={handleNextMonth} className="rounded-xl h-9 w-9">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="h-10 w-px bg-border/50 mx-2 hidden sm:block" />

              <div className="flex items-center gap-2">
                <ThemeToggle />
                {employeeData?.isAdmin && (
                  <Button variant="outline" size="icon" onClick={() => setShowAdminPanel(true)} className="rounded-2xl h-10 w-10 border-border/50">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                  </Button>
                )}
                <Button variant="outline" size="icon" onClick={() => setShowCalendarDialog(true)} className="rounded-2xl h-10 w-10 border-border/50">
                  <Calendar className="w-5 h-5" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setShowDsrDialog(true)} className="rounded-2xl h-10 w-10 border-border/50">
                  <Settings className="w-5 h-5" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleLogout} className="rounded-2xl h-10 w-10 border-border/50 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20">
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden md:block text-right">
                  <p className="text-[10px] font-black text-muted-foreground uppercase">Colaborador</p>
                  <h2 className="text-xl font-black text-foreground">#{matricula}</h2>
                </div>
                <Button onClick={async () => {
                  if (!matricula || viewMonth === null || viewYear === null) {
                    console.log("[Update] Missing data:", { matricula, viewMonth, viewYear });
                    return;
                  }
                  console.log("[Update] Starting sync for:", matricula, "(Action Sync v2)");
                  setIsLoading(true);
                  const syncToast = toast({ title: "Sincronizando...", description: "Buscando dados no portal (isso pode levar alguns segundos).", duration: 10000 });
                  try {
                    const result = await fetchMonthData(matricula, viewMonth, viewYear);
                    console.log("[Update] Result:", result.success ? "Success" : "Failed", result.error);
                    
                    if (!result.success) {
                      throw new Error(result.error);
                    }

                    const freshData = result.data;
                    if (!freshData) {
                      console.log("[Update] No data returned");
                      return;
                    }
                    console.log("[Update] Data received, normalizing...");
                    const normalizedData = normalizeNightShifts(freshData.map(d => ({ ...d, times: [...d.times] })));
                    
                    console.log("[Update] Saving batch...");
                    await saveDailyEntriesBatch(matricula, viewMonth, viewYear, normalizedData);

                    console.log("[Update] Reloading local data...");
                    await loadEmployeeData(matricula, viewMonth, viewYear);
                    toast({ title: "Portal sincronizado!" });
                  } catch (e: any) {
                    console.error("[Update] Error:", e);
                    toast({ variant: "destructive", title: "Erro na sincronização", description: e.message || "Portal lento ou fora do ar." });
                  } finally {
                    setIsLoading(false);
                  }
                }} disabled={isLoading} variant="default" className="shadow-xl font-black bg-primary transform transition hover:scale-105">
                  {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <RefreshCcw className="w-5 h-5 mr-3" />}
                  ATUALIZAR DADOS
                </Button>
              </div>
            </div>
          </div>

          <SummaryCards 
            records={employeeData?.dailyRecords || []} 
            previousBalance={employeeData?.previousBalance || '00:00'}
            previousBalanceMonth={employeeData?.previousBalanceMonth}
            previousBalanceYear={employeeData?.previousBalanceYear}
            balanceAdjustment={employeeData?.balanceAdjustment || '00:00'}
            previousHolidayBalance={employeeData?.previousHolidayBalance || 0}
            fixedDsrDays={employeeData?.fixedDsrDays || [0]}
            referenceDsrSunday={employeeData?.referenceDsrSunday}
            dailyWorkload={employeeData?.dailyWorkload || 440}
            holidays={employeeData?.holidays || []}
            onBalanceClick={() => setShowBalanceDialog(true)}
          />

          <DailyRecordsTable 
            records={employeeData?.dailyRecords || []} 
            fixedDsrDays={employeeData?.fixedDsrDays || [0]}
            referenceDsrSunday={employeeData?.referenceDsrSunday}
            dailyWorkload={employeeData?.dailyWorkload || 440}
            holidays={employeeData?.holidays || []}
            onEdit={(r) => setEditingRecord(r)}
            isLoading={isLoading}
          />
        </div>
      </div>

      {employeeData && (
        <>
          <PreviousBalanceDialog 
            open={showBalanceDialog} 
            onOpenChange={setShowBalanceDialog}
            currentBalance={employeeData.previousBalance}
            currentMonth={employeeData.previousBalanceMonth}
            currentYear={employeeData.previousBalanceYear}
            currentAdjustment={employeeData.balanceAdjustment}
            currentHolidayBalance={employeeData.previousHolidayBalance}
            onSave={async (val, m, y, adj, hol) => {
              await saveUserProfile(matricula, { 
                previousBalance: val, 
                previousBalanceMonth: m, 
                previousBalanceYear: y,
                balanceAdjustment: adj,
                previousHolidayBalance: hol,
                updatedAt: new Date().toISOString() 
              });
              if (viewMonth && viewYear) loadEmployeeData(matricula, viewMonth, viewYear);
              setShowBalanceDialog(false);
            }}
          />

          <DsrSettingsDialog 
            open={showDsrDialog}
            onOpenChange={setShowDsrDialog}
            fixedDsrDays={employeeData.fixedDsrDays}
            referenceDsrSunday={employeeData.referenceDsrSunday}
            dailyWorkload={employeeData.dailyWorkload}
            holidays={employeeData.holidays}
            onSave={async (days, ref, workload, hols) => {
              await saveUserProfile(matricula, { 
                fixedDsrDays: JSON.stringify(days), 
                referenceDsrSunday: ref,
                dailyWorkload: workload,
                holidays: JSON.stringify(hols),
                updatedAt: new Date().toISOString() 
              });
              if (viewMonth && viewYear) loadEmployeeData(matricula, viewMonth, viewYear);
              setShowDsrDialog(false);
            }}
          />

          <CalendarViewDialog 
            open={showCalendarDialog}
            onOpenChange={setShowCalendarDialog}
            records={employeeData.dailyRecords}
            fixedDsrDays={employeeData.fixedDsrDays}
            referenceDsrSunday={employeeData.referenceDsrSunday}
            dailyWorkload={employeeData.dailyWorkload}
            holidays={employeeData.holidays}
          />

          {editingRecord && (
            <EditTimesDialog 
              open={!!editingRecord}
              onOpenChange={(open) => !open && setEditingRecord(null)}
              record={editingRecord}
              onSave={async (id, data) => {
                if (viewMonth && viewYear) {
                  await saveSingleEntry(matricula, viewMonth, viewYear, id, data);
                  loadEmployeeData(matricula, viewMonth, viewYear);
                }
                setEditingRecord(null);
              }}
            />
          )}

          {showAdminPanel && (
            <AdminPanel 
              open={showAdminPanel}
              onOpenChange={setShowAdminPanel}
              onRefresh={() => {
                if (viewMonth && viewYear) loadEmployeeData(matricula, viewMonth, viewYear);
              }}
            />
          )}
        </>
      )}
      <Toaster />
    </main>
  );
}
