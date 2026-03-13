
'use server';
/**
 * Server Action que realiza a consulta COMPLETA do mês no portal.
 * Implementa a lógica de navegação ASP.NET AJAX para percorrer todos os dias.
 * Version: 2026-03-13-v2
 */

/**
 * Extrai campos ocultos de um HTML completo ou de uma resposta Delta AJAX.
 */
function updateFields(html: string, currentFields: Record<string, string>): Record<string, string> {
  const fields = { ...currentFields };
  
  // Busca campos ocultos padrão do ASP.NET em todo o conteúdo (HTML ou Delta)
  // O formato no Delta é |hiddenField|id|value| mas o regex abaixo também pega se estiver no formato HTML
  const hiddenRegex = /\|hiddenField\|(__\w+)\|([^|]*)\|/g;
  let hMatch;
  while ((hMatch = hiddenRegex.exec(html)) !== null) {
    fields[hMatch[1]] = hMatch[2];
  }

  // Também busca os campos de estado específicos do AJAX
  const stateRegex = /\|(__VIEWSTATE|__EVENTVALIDATION|__VIEWSTATEGENERATOR)\|([^|]*)\|/g;
  while ((hMatch = stateRegex.exec(html)) !== null) {
    fields[hMatch[1]] = hMatch[2];
  }

  // Fallback para HTML completo ou campos que não vieram no formato Delta acima
  const htmlRegex = /id="(__\w+)"\s+value="([^"]*)"/g;
  let match;
  while ((match = htmlRegex.exec(html)) !== null) {
    fields[match[1]] = match[2];
  }
  
  return fields;
}

function extractTimesFromGrid(html: string): string[] {
  const times: string[] = [];
  
  // Tenta isolar a área da Grid para evitar pegar horários de cabeçalhos ou rodapés (como o Total)
  let searchArea = html;
  const gridMatch = html.match(/<table[^>]*?id="[^"]*?Grid[^"]*?"[^>]*?>([\s\S]*?)<\/table>/i) || 
                    html.match(/<table[^>]*?class="[^"]*?Grid[^"]*?"[^>]*?>([\s\S]*?)<\/table>/i);
  
  if (gridMatch) {
    searchArea = gridMatch[1];
  }

  // Busca horários HH:MM dentro de tags (<td>, <span>, etc)
  const timeRegex = />\s*([0-2]?\d:[0-5]\d)\s*</g;
  let match;
  while ((match = timeRegex.exec(searchArea)) !== null) {
    times.push(match[1]);
  }
  
  // Se não achou nada na área da grid, tenta no HTML todo com o fallback
  if (times.length === 0) {
    const fallbackRegex = />\s*([0-2]?\d:[0-5]\d)\s*</g;
    while ((match = fallbackRegex.exec(html)) !== null) {
      times.push(match[1]);
    }
  }

  // NÃO usamos Set aqui para permitir batidas duplicadas (caso ocorram por erro no portal)
  // Mas removemos o "Total" se ele for a última entrada e o número de batidas for ímpar
  // Geralmente o total é a soma, e batidas são pares.
  let finalTimes = times.map(t => {
      const parts = t.split(':');
      return `${parts[0].padStart(2, '0')}:${parts[1]}`;
  });

  // Heurística: Se temos um número ímpar de batidas e a última parece um total (ex: > 4h)
  // ou se o portal costuma colocar o total na última célula.
  // Por enquanto, vamos manter todas e deixar o usuário editar se necessário, 
  // mas vamos remover duplicatas CONSECUTIVAS que são comuns em erros de leitura.
  return finalTimes.filter((t, i) => t !== finalTimes[i - 1]);
}

function extractCalendarData(html: string, targetMonth: number): { days: Record<number, string>, selectedDay: number | null, calendarId: string } {
  const days: Record<number, string> = {};
  let selectedDay: number | null = null;
  let calendarId = 'Calendar'; // Default

  const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const targetMonthName = monthNames[targetMonth - 1];

  // 1. Busca links de dias: href="javascript:__doPostBack('ID','ARG')" title="DIA de MES"
  const linkRegex = /href="javascript:__doPostBack\('([^']+)','(\d+)'\)"[^>]*?title="[^"]*?(\d+)\s+de\s+([^"]+)"/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const id = match[1];
    const arg = match[2];
    const day = parseInt(match[3]);
    const monthStr = match[4].toLowerCase();
    
    calendarId = id; // Assume o ID do primeiro link encontrado
    if (monthStr.includes(targetMonthName)) {
      days[day] = arg;
    }
  }

  // 2. Busca o dia selecionado (que não tem link)
  // Geralmente é um <td> com estilo diferente ou um <span> dentro de um <td>
  // Tentamos encontrar o dia que está no calendário mas não é link
  const allDaysRegex = />\s*(\d{1,2})\s*<\/td>/gi;
  while ((match = allDaysRegex.exec(html)) !== null) {
    const day = parseInt(match[1]);
    if (day >= 1 && day <= 31 && !days[day]) {
      // Se o dia está no HTML mas não é link, e estamos no mês certo, provavelmente é o selecionado
      // Verificamos se o contexto ao redor sugere que é o dia selecionado (ex: cor de fundo)
      const context = html.substring(match.index - 100, match.index + 100);
      if (context.toLowerCase().includes('background-color') || context.toLowerCase().includes('selected') || context.toLowerCase().includes('font-weight:bold')) {
          selectedDay = day;
      }
    }
  }

  return { days, selectedDay, calendarId };
}

export async function fetchMonthData(matricula: string, month: number, year: number) {
  const results: { date: string, times: string[] }[] = [];
  const TARGET_URL = "https://webapp.confianca.com.br/consultaponto/ponto.aspx";

  try {
    const commonHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Origin': 'https://webapp.confianca.com.br',
      'Referer': TARGET_URL,
    };

    // 0. GET inicial
    console.log(`[Fetch] Iniciando GET em ${TARGET_URL}`);
    const responseGet = await fetch(TARGET_URL, {
      method: 'GET',
      headers: commonHeaders
    });
    
    let html = await responseGet.text();
    let cookies: string[] = [];
    if (typeof responseGet.headers.getSetCookie === 'function') {
      cookies = responseGet.headers.getSetCookie();
    } else {
      const setCookie = responseGet.headers.get('set-cookie');
      if (setCookie) cookies = [setCookie];
    }
    
    let hiddenFields = updateFields(html, {});

    // --- NAVEGAÇÃO DE MÊS ---
    const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const targetMonthName = monthNames[month - 1];
    const targetYearStr = year.toString();

    const calendarTitleRegex = /<td[^>]*?>\s*([a-zç]+)\s+de\s+(\d{4})\s*<\/td>/gi;
    let titleMatch = calendarTitleRegex.exec(html);
    let currentMonthName = titleMatch ? titleMatch[1].toLowerCase() : "";
    let currentYearStr = titleMatch ? titleMatch[2] : "";

    let navAttempts = 0;
    while ((currentMonthName !== targetMonthName || currentYearStr !== targetYearStr) && navAttempts < 12) {
      navAttempts++;
      const currentMonthIdx = monthNames.indexOf(currentMonthName);
      const targetMonthIdx = monthNames.indexOf(targetMonthName);
      
      let navTarget = 'V4321'; // Prev
      if (year > parseInt(currentYearStr) || (year === parseInt(currentYearStr) && targetMonthIdx > currentMonthIdx)) {
        navTarget = 'V4322'; // Next
      }

      const bodyNav = new URLSearchParams();
      Object.entries(hiddenFields).forEach(([k, v]) => bodyNav.append(k, v));
      bodyNav.set('__EVENTTARGET', 'Calendar');
      bodyNav.set('__EVENTARGUMENT', navTarget);
      bodyNav.set('txtMatricula', matricula);
      bodyNav.set('ScriptManager1', 'UpdatePanel1|Calendar');

      const respNav = await fetch(TARGET_URL, {
        method: 'POST',
        headers: { ...commonHeaders, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookies.join('; '), 'X-MicrosoftAjax': 'Delta=true' },
        body: bodyNav.toString()
      });

      const deltaHtmlNav = await respNav.text();
      html = deltaHtmlNav;
      hiddenFields = updateFields(deltaHtmlNav, hiddenFields);
      
      calendarTitleRegex.lastIndex = 0;
      titleMatch = calendarTitleRegex.exec(deltaHtmlNav);
      if (titleMatch) {
        currentMonthName = titleMatch[1].toLowerCase();
        currentYearStr = titleMatch[2];
      }
    }

    // --- EXTRAÇÃO DOS DIAS ---
    const { days: calendarArgs, selectedDay, calendarId } = extractCalendarData(html, month);
    const today = new Date();
    const isPastMonth = year < today.getFullYear() || (year === today.getFullYear() && month < (today.getMonth() + 1));
    const lastDayToFetch = isPastMonth ? 31 : today.getDate();

    // Se o dia selecionado for um dos que queremos, já extraímos os dados dele
    if (selectedDay && selectedDay <= lastDayToFetch) {
      console.log(`[Fetch] Dia ${selectedDay} já está selecionado. Extraindo...`);
      // Clica em consultar para garantir que a grid está atualizada para o dia selecionado
      const bodyConsultar = new URLSearchParams();
      Object.entries(hiddenFields).forEach(([k, v]) => bodyConsultar.append(k, v));
      bodyConsultar.set('__EVENTTARGET', 'btnConsultar');
      bodyConsultar.set('txtMatricula', matricula);
      bodyConsultar.set('ScriptManager1', 'UpdatePanel1|btnConsultar');

      const respFinal = await fetch(TARGET_URL, {
        method: 'POST',
        headers: { ...commonHeaders, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookies.join('; '), 'X-MicrosoftAjax': 'Delta=true' },
        body: bodyConsultar.toString()
      });
      const deltaHtmlFinal = await respFinal.text();
      const times = extractTimesFromGrid(deltaHtmlFinal);
      if (times.length > 0) {
        results.push({ date: `${selectedDay.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`, times });
      }
      hiddenFields = updateFields(deltaHtmlFinal, hiddenFields);
    }

    // Loop pelos outros dias
    const daysToFetch = Object.keys(calendarArgs).map(Number).sort((a, b) => a - b);
    for (const day of daysToFetch) {
      if (day > lastDayToFetch || day === selectedDay) continue;

      console.log(`[Fetch] Navegando para dia ${day}...`);
      const dayArg = calendarArgs[day];
      
      // PASSO 1: Selecionar o dia
      const bodyDay = new URLSearchParams();
      Object.entries(hiddenFields).forEach(([k, v]) => bodyDay.append(k, v));
      bodyDay.set('__EVENTTARGET', calendarId);
      bodyDay.set('__EVENTARGUMENT', dayArg);
      bodyDay.set('txtMatricula', matricula);
      bodyDay.set('ScriptManager1', `UpdatePanel1|${calendarId}`);

      const respDay = await fetch(TARGET_URL, {
        method: 'POST',
        headers: { ...commonHeaders, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookies.join('; '), 'X-MicrosoftAjax': 'Delta=true' },
        body: bodyDay.toString()
      });
      
      const deltaHtmlDay = await respDay.text();
      hiddenFields = updateFields(deltaHtmlDay, hiddenFields);

      // PASSO 2: Consultar horários
      const bodyConsultar = new URLSearchParams();
      Object.entries(hiddenFields).forEach(([k, v]) => bodyConsultar.append(k, v));
      bodyConsultar.set('__EVENTTARGET', 'btnConsultar');
      bodyConsultar.set('txtMatricula', matricula);
      bodyConsultar.set('ScriptManager1', 'UpdatePanel1|btnConsultar');

      const respFinal = await fetch(TARGET_URL, {
        method: 'POST',
        headers: { ...commonHeaders, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookies.join('; '), 'X-MicrosoftAjax': 'Delta=true' },
        body: bodyConsultar.toString()
      });
      
      const deltaHtmlFinal = await respFinal.text();
      const times = extractTimesFromGrid(deltaHtmlFinal);

      if (times.length > 0) {
        console.log(`[Fetch] Dia ${day}: ${times.join(', ')}`);
        results.push({
          date: `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`,
          times
        });
      }
      
      hiddenFields = updateFields(deltaHtmlFinal, hiddenFields);
    }

    console.log(`[Fetch] Finalizado. Total de dias com dados: ${results.length}`);
    return { success: true, data: results.sort((a, b) => a.date.localeCompare(b.date)) };
  } catch (error: any) {
    console.error("Erro na extração:", error);
    return { success: false, error: error.message || "Falha de comunicação com o portal." };
  }
}
