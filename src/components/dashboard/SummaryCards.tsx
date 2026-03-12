
'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp, Landmark, Coffee, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { timeToMinutes, minutesToTime, calculateDailyWorkedMinutes, sortPontoHours, isDateDsr } from '@/lib/ponto-utils';
import { DailyRecord } from '@/app/page';
import { cn } from '@/lib/utils';

interface SummaryCardsProps {
  records: DailyRecord[];
  previousBalance: string;
  previousBalanceMonth?: number;
  previousBalanceYear?: number;
  balanceAdjustment?: string;
  previousHolidayBalance: number;
  fixedDsrDays: number[];
  referenceDsrSunday?: string | null;
  dailyWorkload: number;
  holidays: string[];
  onBalanceClick?: () => void;
  currentViewMonth?: number;
  currentViewYear?: number;
}

export function SummaryCards({ 
  records, 
  previousBalance, 
  previousBalanceMonth,
  previousBalanceYear,
  balanceAdjustment = '00:00',
  previousHolidayBalance,
  fixedDsrDays, 
  referenceDsrSunday, 
  dailyWorkload,
  holidays,
  onBalanceClick,
  currentViewMonth,
  currentViewYear
}: SummaryCardsProps) {
  const [todayStr, setTodayStr] = useState<string>('');

  useEffect(() => {
    setTodayStr(new Date().toLocaleDateString('pt-BR'));
  }, []);

  const stats = useMemo(() => {
    let totalWorkedMinutes = 0;
    let totalGoalMinutes = 0;
    let holidayCredits = 0;
    let holidayUsed = 0;

    if (!todayStr) return null;

    const today = new Date();
    today.setHours(0,0,0,0);

    records.forEach(record => {
      // Regra: Não calcula o saldo do dia atual para não afetar o banco de horas enquanto o usuário trabalha
      if (record.date === todayStr) return;

      const [day, month, year] = record.date.split('/').map(Number);
      const dateObj = new Date(year, month - 1, day);

      // NOVO: Dias futuros não contam no banco
      if (dateObj > today) return;

      // NOVO: Respeitar o mês/ano inicial de saldo
      if (previousBalanceYear && previousBalanceMonth) {
        if (year < previousBalanceYear || (year === previousBalanceYear && month < previousBalanceMonth)) {
          return;
        }
      }

      const { isDsr: calendarDsr, isHoliday: calendarHoliday } = isDateDsr(dateObj, fixedDsrDays, referenceDsrSunday, holidays);
      
      const sorted = sortPontoHours(record.times);
      const dailyWorked = calculateDailyWorkedMinutes(
        sorted.filter((_, i) => i % 2 === 0),
        sorted.filter((_, i) => i % 2 !== 0)
      );
      
      const isManualFolga = record.isManualDsr || record.isBankOff || record.isCompensation;
      const isSystemHoliday = calendarHoliday || record.isHoliday;
      const isSystemDsr = calendarDsr;
      
      const isMetaZero = (isManualFolga || isSystemHoliday || isSystemDsr) && !record.isManualWork;
      const goalForDay = isMetaZero ? 0 : dailyWorkload;

      if (dailyWorked > 0 || !isMetaZero) {
        totalWorkedMinutes += dailyWorked;
        totalGoalMinutes += goalForDay;
      }
      
      if ((isSystemHoliday) && dailyWorked > 0) holidayCredits++;
      if (record.isCompensation) holidayUsed++;
    });

    const prevBalanceMinutes = timeToMinutes(previousBalance);
    const adjustmentMinutes = timeToMinutes(balanceAdjustment);
    const monthBalanceMinutes = totalWorkedMinutes - totalGoalMinutes;
    
    // O banco total só mostra se estivermos visualizando o mês do saldo ou superior
    let totalBalanceMinutes = 0;
    let showTotal = true;

    if (previousBalanceYear && previousBalanceMonth && currentViewYear && currentViewMonth) {
      if (currentViewYear < previousBalanceYear || (currentViewYear === previousBalanceYear && currentViewMonth < previousBalanceMonth)) {
        showTotal = false;
      }
    }

    if (showTotal) {
      totalBalanceMinutes = monthBalanceMinutes + prevBalanceMinutes + adjustmentMinutes;
    }

    return {
      monthTotal: minutesToTime(totalWorkedMinutes),
      monthBalance: minutesToTime(monthBalanceMinutes, true),
      monthBalanceMinutes,
      totalBalance: showTotal ? minutesToTime(totalBalanceMinutes, true) : "---",
      isPositive: totalBalanceMinutes >= 0,
      isMonthPositive: monthBalanceMinutes >= 0,
      holidayBalance: holidayCredits - holidayUsed + (previousHolidayBalance || 0),
      showTotal
    };
  }, [records, previousBalance, previousBalanceMonth, previousBalanceYear, balanceAdjustment, previousHolidayBalance, fixedDsrDays, referenceDsrSunday, dailyWorkload, holidays, todayStr, currentViewMonth, currentViewYear]);

  if (!stats) return null;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card className={cn(
        "border-l-4 shadow-sm bg-card transition-colors",
        stats.isMonthPositive ? 'border-l-primary' : 'border-l-destructive'
      )}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-[11px] font-black text-foreground uppercase tracking-tighter">Saldo do Mês</CardTitle>
          {stats.isMonthPositive ? <ArrowUpRight className="h-4 w-4 text-primary" /> : <ArrowDownRight className="h-4 w-4 text-destructive" />}
        </CardHeader>
        <CardContent>
          <div className={cn(
            "text-2xl font-black",
            stats.isMonthPositive ? "text-primary" : "text-destructive"
          )}>{stats.monthBalance}</div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase">Crédito/Débito Mensal</p>
        </CardContent>
      </Card>

      <Card 
        onClick={onBalanceClick}
        className="border-l-4 border-l-amber-600 shadow-sm bg-card cursor-pointer hover:bg-accent transition-colors"
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-[11px] font-black text-foreground uppercase tracking-tighter">Folgas Feriado</CardTitle>
          <Landmark className="h-4 w-4 text-amber-600" />
        </CardHeader>
        <CardContent>
          <div className={cn(
            "text-2xl font-black",
            stats.holidayBalance >= 0 ? "text-foreground" : "text-destructive"
          )}>
            {stats.holidayBalance} dias
          </div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase">Acumulado p/ Compensar</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-muted-foreground/30 shadow-sm bg-card transition-colors">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-[11px] font-black text-foreground uppercase tracking-tighter">Meta Diária</CardTitle>
          <Coffee className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-black text-foreground">{minutesToTime(dailyWorkload)}</div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase">Base de Horas</p>
        </CardContent>
      </Card>

      <Card 
        onClick={onBalanceClick}
        className={cn(
          "border-l-4 shadow-sm bg-card cursor-pointer hover:bg-accent transition-colors",
          !stats.showTotal ? 'border-l-slate-300' : (stats.isPositive ? 'border-l-green-600' : 'border-l-destructive')
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-[11px] font-black text-foreground uppercase tracking-tighter">Banco Geral</CardTitle>
          <TrendingUp className={cn("h-4 w-4", !stats.showTotal ? 'text-slate-300' : (stats.isPositive ? 'text-green-600' : 'text-destructive'))} />
        </CardHeader>
        <CardContent>
          <div className={cn(
            "text-2xl font-black",
            !stats.showTotal ? 'text-slate-400' : (stats.isPositive ? 'text-green-700' : 'text-destructive')
          )}>
            {stats.totalBalance}
          </div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase">Saldo Final Acumulado</p>
        </CardContent>
      </Card>
    </div>
  );
}
