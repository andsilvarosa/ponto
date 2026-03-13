
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, RotateCcw, Search, Clock, AlertCircle, RefreshCw, Calendar as CalendarIcon, CheckCircle2, XCircle, Coffee } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { minutesToTime, timeToMinutes, calculateDailyWorkedMinutes, sortPontoHours, isDateDsr } from '@/lib/ponto-utils';
import { cn } from '@/lib/utils';
import { getAllUsers, getMonthlyEntries, resetUserAuthVersion } from '@/actions/db-actions';

interface AdminPanelProps {
  onRefresh?: (refreshFn: () => void) => void;
}

export function AdminPanel({ onRefresh }: AdminPanelProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [scheduleDate, setScheduleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [scheduleData, setScheduleData] = useState<any[]>([]);
  
  useEffect(() => {
    fetchUsers();
    if (onRefresh) onRefresh(fetchUsers);
  }, []);

  useEffect(() => {
    if (activeTab === 'schedule') {
      fetchSchedule();
    }
  }, [activeTab, scheduleDate, users]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const usersList = await getAllUsers();
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const safeParse = (val: any, fallback: any) => {
        if (!val) return fallback;
        if (typeof val !== 'string') return val;
        try {
          return JSON.parse(val);
        } catch (e) {
          return fallback;
        }
      };

      const userList = await Promise.all(usersList.map(async (data: any) => {
        const matricula = data.matricula;
        let totalBalanceStr = "---";
        
        try {
          const startMonth = data.previousBalanceMonth || 1;
          const startYear = data.previousBalanceYear || 2000;
          const isViewAfterStart = currentYear > startYear || (currentYear === startYear && currentMonth >= startMonth);

          let monthWorked = 0;
          let monthGoal = 0;

          if (isViewAfterStart) {
            const records = await getMonthlyEntries(matricula, currentMonth, currentYear);
            const todayStr = new Date().toLocaleDateString('pt-BR');
            
            records.forEach((r: any) => {
              if (r.date === todayStr) return;
              const times = safeParse(r.times, []);
              const sorted = sortPontoHours(times);
              const worked = calculateDailyWorkedMinutes(
                sorted.filter((_: any, i: number) => i % 2 === 0),
                sorted.filter((_: any, i: number) => i % 2 !== 0)
              );
              const [d, m, y] = r.date.split('/').map(Number);
              const dateObj = new Date(y, m-1, d);
              if (dateObj > now) return;
              
              const fixedDsrDays = safeParse(data.fixedDsrDays, [0]);
              const holidays = safeParse(data.holidays, []);
              
              const { isDsr, isHoliday } = isDateDsr(dateObj, fixedDsrDays, data.referenceDsrSunday, holidays);
              const isMetaZero = isDsr || isHoliday || r.isManualDsr || r.isHoliday || r.isBankOff || r.isCompensation;
              const goalForDay = isMetaZero ? 0 : (data.dailyWorkload || 440);
              if (worked > 0 || !isMetaZero) {
                monthWorked += worked;
                monthGoal += goalForDay;
              }
            });
          }

          const prevBalance = timeToMinutes(data.previousBalance || '00:00');
          const adjBalance = timeToMinutes(data.balanceAdjustment || '00:00');
          const totalBalanceMinutes = isViewAfterStart ? (monthWorked - monthGoal) + prevBalance + adjBalance : prevBalance + adjBalance;
          totalBalanceStr = minutesToTime(totalBalanceMinutes, true);
        } catch (e) {
          totalBalanceStr = data.previousBalance || "---";
        }

        return {
          id: matricula,
          registrationNumber: data.registrationNumber || matricula,
          uid: data.uid,
          authVersion: data.authVersion || 0,
          totalBalance: totalBalanceStr,
          rawProfile: data
        };
      }));

      setUsers(userList.sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber)));
    } catch (e: any) {
      console.error("Erro no fetchUsers ADM:", e);
      toast({ variant: "destructive", title: "Erro ao carregar usuários" });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchSchedule = async () => {
    if (users.length === 0) return;
    const [y, m, d] = scheduleDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dateStr = `${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y}`;
    const dayId = dateStr.replace(/\//g, '-');

    const safeParse = (val: any, fallback: any) => {
      if (!val) return fallback;
      if (typeof val !== 'string') return val;
      try {
        return JSON.parse(val);
      } catch (e) {
        return fallback;
      }
    };

    const results = await Promise.all(users.map(async (u) => {
      if (u.id === '000000') return null;

      const records = await getMonthlyEntries(u.id, m, y);
      const manualEntry = records.find((r: any) => r.id === `${u.id}_${dayId}`) || null;

      const fixedDsrDays = safeParse(u.rawProfile.fixedDsrDays, [0]);
      const holidays = safeParse(u.rawProfile.holidays, []);

      const { isDsr, isHoliday } = isDateDsr(dateObj, fixedDsrDays, u.rawProfile.referenceDsrSunday, holidays);
      const isManualFolga = manualEntry?.isManualDsr || manualEntry?.isBankOff || manualEntry?.isCompensation || (isHoliday && !manualEntry?.isManualWork);
      const isSystemDsr = isDsr && !manualEntry?.isManualWork;
      
      const isWorking = !isManualFolga && !isSystemDsr;

      return {
        id: u.id,
        matricula: u.registrationNumber,
        isWorking,
        statusLabel: isManualFolga ? (manualEntry?.isBankOff ? 'Banco de Horas' : manualEntry?.isCompensation ? 'Compensação' : isHoliday ? 'Feriado' : 'Folga Manual') : (isSystemDsr ? 'DSR/Escala' : 'Escalado'),
        times: manualEntry?.times || []
      };
    }));

    setScheduleData(results.filter(r => r !== null));
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchUsers();
  };

  const handleResetPassword = async (matricula: string) => {
    try {
      await resetUserAuthVersion(matricula);
      toast({ title: `Acesso de ${matricula} resetado!` });
      fetchUsers();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao resetar", description: e.message });
    }
  };

  const filteredUsers = users.filter(u => (u.registrationNumber || '').includes(search));
  const workingStaff = scheduleData.filter(s => s.isWorking);
  const offStaff = scheduleData.filter(s => !s.isWorking);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Tabs defaultValue="users" onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4 bg-card p-4 rounded-xl border shadow-sm">
          <TabsList className="grid w-full md:w-80 grid-cols-2">
            <TabsTrigger value="users" className="font-black text-[10px] uppercase">Colaboradores</TabsTrigger>
            <TabsTrigger value="schedule" className="font-black text-[10px] uppercase">Escala do Dia</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            {activeTab === 'users' ? (
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input placeholder="Buscar matrícula..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 font-bold h-9" />
              </div>
            ) : (
              <div className="relative flex-1 md:w-64">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="pl-10 font-bold h-9" />
              </div>
            )}
            <Button variant="outline" size="icon" onClick={handleManualRefresh} disabled={isRefreshing || isLoading} className="h-9 w-9">
              <RefreshCw className={isRefreshing ? "animate-spin w-4 h-4" : "w-4 h-4"} />
            </Button>
          </div>
        </div>

        <TabsContent value="users">
          <Card className="border-border shadow-xl overflow-hidden bg-card">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-20 flex flex-col items-center gap-4">
                  <Loader2 className="animate-spin text-primary w-12 h-12" />
                  <p className="text-xs font-black text-muted-foreground uppercase">Calculando saldos...</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted">
                      <TableHead className="font-black text-foreground uppercase text-[11px] border-r">Matrícula</TableHead>
                      <TableHead className="font-black text-foreground uppercase text-[11px]">Status / Versão</TableHead>
                      <TableHead className="font-black text-foreground uppercase text-[11px] text-right bg-primary/5">Saldo Acumulado</TableHead>
                      <TableHead className="font-black text-foreground uppercase text-[11px] text-center w-40">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.id} className="hover:bg-accent/30 border-border">
                        <TableCell className="font-black text-foreground text-lg tracking-widest border-r">{u.registrationNumber}</TableCell>
                        <TableCell className="text-muted-foreground font-bold">
                          <div className="flex flex-col">
                            <span className={u.uid ? "text-green-600 text-[10px] uppercase" : "text-amber-600 text-[10px] uppercase"}>
                              {u.uid ? '● Ativo' : '○ Aguardando Vínculo'}
                            </span>
                            <span className="text-[10px] opacity-70 text-foreground">v{u.authVersion || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right bg-primary/5">
                          <span className={cn("px-3 py-1 rounded-md font-black text-sm inline-flex items-center gap-2 border", u.totalBalance.startsWith('-') ? 'bg-red-500/10 text-red-600 border-red-500/20' : 'bg-green-500/10 text-green-600 border-green-500/20')}>
                            <Clock className="w-3.5 h-3.5" /> {u.totalBalance}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {u.registrationNumber !== '000000' && (
                            <Button variant="ghost" size="sm" onClick={() => handleResetPassword(u.registrationNumber)} className="font-black text-[10px] uppercase text-destructive hover:bg-destructive/10">
                              <RotateCcw className="w-3 h-3 mr-2" /> Resetar Senha
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-border shadow-md">
              <CardHeader className="bg-primary/5 border-b py-3">
                <CardTitle className="text-sm font-black flex items-center gap-2 text-primary uppercase">
                  <CheckCircle2 className="w-4 h-4" /> Escalados para o Dia ({workingStaff.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {workingStaff.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-black text-sm">#{s.matricula}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="text-[10px] font-black border-primary/20 bg-primary/5 text-primary">TRABALHA</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {workingStaff.length === 0 && (
                      <TableRow><TableCell className="text-center p-8 text-muted-foreground font-bold">Ninguém escalado para esta data.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-border shadow-md">
              <CardHeader className="bg-amber-500/5 border-b py-3">
                <CardTitle className="text-sm font-black flex items-center gap-2 text-amber-600 uppercase">
                  <Coffee className="w-4 h-4" /> De Folga / DSR ({offStaff.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {offStaff.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-black text-sm">#{s.matricula}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="text-[10px] font-black border-amber-500/20 bg-amber-500/5 text-amber-600">{s.statusLabel.toUpperCase()}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {offStaff.length === 0 && (
                      <TableRow><TableCell className="text-center p-8 text-muted-foreground font-bold">Nenhuma folga registrada.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
