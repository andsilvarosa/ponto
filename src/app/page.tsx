
'use client';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

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
  isManual?: boolean;
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

export default function Home() {
  const [matricula, setMatricula] = useState<string | null>(null);
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMonth, setViewMonth] = useState<number>(new Date().getMonth() + 1);
  const [viewYear, setViewYear] = useState<number>(new Date().getFullYear());
  
  const [showBalanceDialog, setShowBalanceDialog] = useState(false);
  const [showDsrDialog, setShowDsrDialog] = useState(false);
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DailyRecord | null>(null);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoSyncedMonths, setAutoSyncedMonths] = useState<string[]>([]);
  
  const [isUserLoading, setIsUserLoading] = useState(true);

  useEffect(() => {
    setIsUserLoading(false);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('logged_matricula');
    if (saved && !isUserLoading) {
      setMatricula(saved);
      loadEmployeeData(saved, viewMonth, viewYear);
    }
  }, [isUserLoading]);

  const handleSync = async (m: string, month: number, year: number, isAuto = false) => {
    if (isSyncing) return;
    
    const monthKey = `${m}_${month}_${year}`;
    if (isAuto && autoSyncedMonths.includes(monthKey)) return;

    console.log(`[Sync] Starting ${isAuto ? 'auto' : 'manual'} sync for:`, m);
    setIsSyncing(true);
    
    const syncToast = toast({ 
      title: isAuto ? "Sincronizando automaticamente..." : "Sincronizando...", 
      description: "Buscando dados no portal para este mês.",
      duration: 5000 
    });

    try {
      const result = await fetchMonthData(m, month, year);
      if (!result.success) throw new Error(result.error);

      const freshData = result.data;
      if (freshData) {
        const normalizedData = normalizeNightShifts(freshData.map(d => ({ 
          ...d, 
          id: d.date.replace(/\//g, '-'),
          times: [...d.times] 
        })));
        
        await saveDailyEntriesBatch(m, month, year, normalizedData);
        if (isAuto) setAutoSyncedMonths(prev => [...prev, monthKey]);
        
        // Recarrega apenas os dados locais após o sync
        await loadEmployeeData(m, month, year, true);
        toast({ title: "Dados atualizados!" });
      }
    } catch (e: any) {
      console.error("[Sync] Error:", e);
      if (!isAuto) {
        toast({ variant: "destructive", title: "Erro na sincronização", description: e.message || "Portal lento ou fora do ar." });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const loadEmployeeData = async (m: string, month: number, year: number, skipSyncCheck = false) => {
    // Só mostra o loader principal se não tivermos dado nenhum ainda
    if (!employeeData) setIsLoading(true);
    
    try {
      let base = await getUserProfile(m) || { isAdmin: m === '000000' } as any;
      const rawRecords = await getMonthlyEntries(m, month, year);
      
      // Verifica se o mês está vazio (sem batidas reais)
      const hasPunches = rawRecords.some((r: any) => r.times && JSON.parse(r.times).length > 0);
      
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
            id: `v-${dateStr.replace(/\//g, '-')}`,
            date: dateStr,
            times: []
          });
        }
      }

      const normalized = normalizeNightShifts(fullMonthRecords);
      const todayLimit = new Date();
      todayLimit.setHours(0,0,0,0);

      const sortedRecords = normalized.sort((a, b) => {
          const [dA, mA, yA] = a.date.split('/').map(Number);
          const [dB, mB, yB] = b.date.split('/').map(Number);
          const dateA = new Date(yA, mA - 1, dA);
          const dateB = new Date(yB, mB - 1, dB);
          const isTodayA = dateA.getTime() === todayLimit.getTime();
          const isTodayB = dateB.getTime() === todayLimit.getTime();
          if (isTodayA) return -1;
          if (isTodayB) return 1;
          const isFutureA = dateA > todayLimit;
          const isFutureB = dateB > todayLimit;
          if (!isFutureA && isFutureB) return -1;
          if (isFutureA && !isFutureB) return 1;
          if (!isFutureA && !isFutureB) return dateB.getTime() - dateA.getTime();
          return dateA.getTime() - dateB.getTime();
      });

      setEmployeeData({
        ...base,
        id: m,
        matricula: m,
        dailyRecords: sortedRecords,
        isAdmin: m === '000000',
        fixedDsrDays: base.fixedDsrDays || [0],
        dailyWorkload: base.dailyWorkload || 440,
        holidays: base.holidays || [],
        referenceDsrSunday: base.referenceDsrSunday || null,
        previousHolidayBalance: base.previousHolidayBalance || 0,
        previousBalance: base.previousBalance || '00:00',
        previousBalanceMonth: base.previousBalanceMonth,
        previousBalanceYear: base.previousBalanceYear,
        balanceAdjustment: base.balanceAdjustment || '00:00',
        uid: base.uid,
        authVersion: base.authVersion || 0
      } as EmployeeData);

      // Se não houver batidas no banco e não pedimos para pular, sincroniza automaticamente
      if (!hasPunches && !skipSyncCheck && m !== '000000') {
        handleSync(m, month, year, true);
      }

    } catch (e) { 
      console.error("Erro ao carregar dados:", e);
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('logged_matricula');
      setMatricula(null);
      setEmployeeData(null);
      setShowAdminPanel(false);
      setViewMonth(new Date().getMonth() + 1);
      setViewYear(new Date().getFullYear());
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  const changeMonth = (dir: number) => {
    if (viewMonth === null || viewYear === null) return;
    let newMonth = viewMonth + dir;
    let newYear = viewYear;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1) { newMonth = 12; newYear--; }
    setViewMonth(newMonth);
    setViewYear(newYear);
  };

  if (isUserLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary w-12 h-12" /></div>;

  const isAdminUser = matricula === '000000';

  return (
    <main className="min-h-screen bg-background p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card p-6 rounded-2xl shadow-sm border border-border">
          <div className="flex items-center gap-4">
            <div className="space-y-1 text-center md:text-left">
              <h1 className="text-4xl font-black text-primary tracking-tight">Ponto <span className="text-foreground">Ágil</span></h1>
              <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">Controle de Jornada</p>
            </div>
            <ThemeToggle />
          </div>
          {matricula && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {isAdminUser && (
                <Button variant={showAdminPanel ? "default" : "outline"} size="sm" onClick={() => setShowAdminPanel(!showAdminPanel)} className="font-black border-primary/30">
                  <ShieldCheck className="w-4 h-4 mr-2" /> {showAdminPanel ? 'MEU PONTO' : 'PAINEL ADM'}
                </Button>
              )}
              {!showAdminPanel && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setShowBalanceDialog(true)} className="bg-card border-primary/30 font-black"><Wallet className="w-4 h-4 mr-2" /> SALDO</Button>
                  <Button variant="outline" size="sm" onClick={() => setShowCalendarDialog(true)} className="bg-card border-primary/30 font-black"><Calendar className="w-4 h-4 mr-2" /> CALENDÁRIO</Button>
                  <Button variant="outline" size="sm" onClick={() => setShowDsrDialog(true)} className="bg-card border-primary/30 font-black"><Settings className="w-4 h-4 mr-2" /> ESCALA</Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={handleLogout} className="font-bold text-destructive hover:bg-destructive/10"><LogOut className="w-4 h-4 mr-2" /> Sair</Button>
            </div>
          )}
        </header>

        {!matricula ? (
          <div className="py-20">
            <MatriculaInput onLogin={async (m, p, isSignUp) => {
              try {
                // TODO: Implementar autenticação real com Cloudflare Access ou Auth.js
                // Por enquanto, apenas salva o perfil e faz o login simulado
                await saveUserProfile(m, {
                  uid: `simulated_uid_${m}`, // Simula um UID
                  registrationNumber: m,
                  updatedAt: new Date().toISOString(),
                  isAdmin: m === '000000'
                });
                
                localStorage.setItem('logged_matricula', m);
                setMatricula(m);
              } catch (e: any) {
                toast({ variant: "destructive", title: "Erro de Acesso", description: e.message });
              }
            }} isLoading={isLoading} />
          </div>
        ) : showAdminPanel && isAdminUser ? (
          <AdminPanel />
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-card p-6 rounded-2xl border border-border shadow-md">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-muted p-1 rounded-xl border">
                  <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)}><ChevronLeft /></Button>
                  <div className="min-w-[150px] text-center font-black uppercase text-sm">
                    {new Date(viewYear, viewMonth - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => changeMonth(1)}><ChevronRight /></Button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden md:block text-right">
                  <p className="text-[10px] font-black text-muted-foreground uppercase">Colaborador</p>
                  <h2 className="text-xl font-black text-foreground">#{matricula}</h2>
                </div>
                <Button onClick={() => {
                  if (matricula && viewMonth !== null && viewYear !== null) {
                    handleSync(matricula, viewMonth, viewYear);
                  }
                }} disabled={isSyncing} variant="default" className="shadow-xl font-black bg-primary transform transition hover:scale-105">
                  {isSyncing ? <Loader2 className="animate-spin w-5 h-5" /> : <RefreshCcw className="w-5 h-5 mr-3" />}
                  ATUALIZAR DADOS
                </Button>
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
              currentViewMonth={viewMonth}
              currentViewYear={viewYear}
            />

            <DailyRecordsTable 
              records={employeeData?.dailyRecords || []} 
              fixedDsrDays={employeeData?.fixedDsrDays || [0]}
              referenceDsrSunday={employeeData?.referenceDsrSunday}
              dailyWorkload={employeeData?.dailyWorkload || 440}
              holidays={employeeData?.holidays || []}
              onEdit={setEditingRecord}
            />
          </div>
        )}

        <PreviousBalanceDialog isOpen={showBalanceDialog} 
          currentBalance={employeeData?.previousBalance}
          currentMonth={employeeData?.previousBalanceMonth}
          currentYear={employeeData?.previousBalanceYear}
          currentAdjustment={employeeData?.balanceAdjustment}
          currentHolidayBalance={employeeData?.previousHolidayBalance}
          onSave={async (b, month, year, adj, hb) => {
            if (matricula) {
              await saveUserProfile(matricula, { 
                previousBalance: b, previousBalanceMonth: month, previousBalanceYear: year,
                balanceAdjustment: adj, previousHolidayBalance: hb 
              });
              setShowBalanceDialog(false);
              loadEmployeeData(matricula, viewMonth!, viewYear!);
            }
          }} onClose={() => setShowBalanceDialog(false)} />
        
        <DsrSettingsDialog 
          isOpen={showDsrDialog} 
          fixedDsrDays={employeeData?.fixedDsrDays || [0]} 
          referenceSunday={employeeData?.referenceDsrSunday || null}
          dailyWorkload={employeeData?.dailyWorkload || 440}
          holidays={employeeData?.holidays || []}
          onSave={async (days, refSun, workload, hdays) => {
            if (matricula) {
              await saveUserProfile(matricula, { 
                fixedDsrDays: days, referenceDsrSunday: refSun, dailyWorkload: workload, holidays: hdays 
              });
              setShowDsrDialog(false);
              loadEmployeeData(matricula, viewMonth!, viewYear!);
            }
          }} onClose={() => setShowDsrDialog(false)} 
        />

        <CalendarViewDialog 
          isOpen={showCalendarDialog} records={employeeData?.dailyRecords || []}
          fixedDsrDays={employeeData?.fixedDsrDays || [0]} referenceDsrSunday={employeeData?.referenceDsrSunday}
          dailyWorkload={employeeData?.dailyWorkload || 440} holidays={employeeData?.holidays || []}
          onClose={() => setShowCalendarDialog(false)}
        />

        {editingRecord && (
          <EditTimesDialog 
            isOpen={!!editingRecord} record={editingRecord}
            onSave={async (times, opts) => {
              if (matricula) {
                setIsLoading(true);
                try {
                  const dayId = editingRecord.date.replace(/\//g, '-');
                  const result = await saveSingleEntry(matricula, viewMonth!, viewYear!, dayId, {
                    times, date: editingRecord.date, ...opts
                  });
                  
                  if (result.success) {
                    toast({ title: "Alteração salva!", description: `O dia ${editingRecord.date} foi atualizado com sucesso.` });
                    setEditingRecord(null);
                    await loadEmployeeData(matricula, viewMonth!, viewYear!);
                  } else {
                    toast({ variant: "destructive", title: "Erro ao salvar", description: result.error });
                  }
                } catch (e: any) {
                  toast({ variant: "destructive", title: "Erro crítico", description: e.message });
                } finally {
                  setIsLoading(false);
                }
              }
            }} onClose={() => setEditingRecord(null)} 
          />
        )}
      </div>
      <Toaster />
    </main>
  );
}
