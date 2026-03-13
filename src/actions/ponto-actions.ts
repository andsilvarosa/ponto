
'use server';
/**
 * Server Action que realiza a consulta COMPLETA do mês no portal.
 * Implementa a lógica de navegação ASP.NET AJAX para percorrer todos os dias.
 */

/**
 * Extrai campos ocultos de um HTML completo ou de uma resposta Delta AJAX.
 */
function updateFields(html: string, currentFields: Record<string, string>): Record<string, string> {
  const fields = { ...currentFields };
  
  // Lógica para respostas AJAX Delta (|length|type|id|content|)
  if (html.includes('|')) {
    const parts = html.split('|');
    for (let i = 0; i < parts.length; i++) {
      const type = parts[i];
      const id = parts[i + 1];
      const content = parts[i + 2];
      
      if (type === 'hiddenField' && id) {
        fields[id] = content;
      }
      if (['__VIEWSTATE', '__EVENTVALIDATION', '__VIEWSTATEGENERATOR'].includes(id)) {
        fields[id] = content;
      }
    }
  }

  // Fallback para HTML completo
  const regex = /id="(__\w+)"\s+value="([^"]*)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    fields[match[1]] = match[2];
  }
  
  return fields;
}

function extractTimesFromGrid(html: string): string[] {
  const times: string[] = [];
  // Busca horários HH:MM dentro da tabela Grid
  const timeRegex = /<td>\s*([0-2]?\d:[0-5]\d)\s*<\/td>/g;
  let match;
  while ((match = timeRegex.exec(html)) !== null) {
    times.push(match[1]);
  }
  
  return Array.from(new Set(times)).map(t => {
      const parts = t.split(':');
      return `${parts[0].padStart(2, '0')}:${parts[1]}`;
  });
}

function extractCalendarArguments(html: string, targetMonth: number): Record<number, string> {
  const map: Record<number, string> = {};
  const linkRegex = /href="javascript:__doPostBack\('Calendar','(\d+)'\)"[^>]*?title="(\d+)\s+de\s+([^"]+)"/gi;
  let match;
  const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const targetMonthName = monthNames[targetMonth - 1];

  while ((match = linkRegex.exec(html)) !== null) {
    const arg = match[1];
    const day = parseInt(match[2]);
    const monthStr = match[3].toLowerCase();
    
    if (monthStr.includes(targetMonthName)) {
      map[day] = arg;
    }
  }
  return map;
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

    // 0. GET inicial para pegar VIEWSTATE e Cookies
    console.log(`[Fetch] Iniciando GET em ${TARGET_URL}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const responseGet = await fetch(TARGET_URL, {
      method: 'GET',
      headers: commonHeaders,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!responseGet.ok) {
      console.error(`[Fetch] Erro no GET inicial: ${responseGet.status}`);
      throw new Error(`Portal indisponível (Status ${responseGet.status})`);
    }

    let html = await responseGet.text();
    
    // Fallback para getSetCookie se não existir
    let cookies: string[] = [];
    if (typeof responseGet.headers.getSetCookie === 'function') {
      cookies = responseGet.headers.getSetCookie();
    } else {
      const setCookie = responseGet.headers.get('set-cookie');
      if (setCookie) cookies = [setCookie];
    }
    
    console.log(`[Fetch] Cookies obtidos: ${cookies.length}`);
    let hiddenFields = updateFields(html, {});

    // --- LÓGICA DE NAVEGAÇÃO DE MÊS ---
    // Verifica se o mês exibido no portal é o mês solicitado
    const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const targetMonthName = monthNames[month - 1];
    const targetYearStr = year.toString();

    // Tenta encontrar o título do calendário (ex: "março de 2024")
    const calendarTitleRegex = /<td[^>]*?>\s*([a-zç]+)\s+de\s+(\d{4})\s*<\/td>/gi;
    let titleMatch = calendarTitleRegex.exec(html);
    let currentMonthName = titleMatch ? titleMatch[1].toLowerCase() : "";
    let currentYearStr = titleMatch ? titleMatch[2] : "";

    console.log(`[Fetch] Mês no portal: ${currentMonthName} ${currentYearStr} | Alvo: ${targetMonthName} ${targetYearStr}`);

    // Se o mês não bater, tenta navegar (máximo 12 tentativas para evitar loop infinito)
    let navAttempts = 0;
    while ((currentMonthName !== targetMonthName || currentYearStr !== targetYearStr) && navAttempts < 12) {
      navAttempts++;
      console.log(`[Fetch] Navegando mês... Tentativa ${navAttempts}`);

      const currentMonthIdx = monthNames.indexOf(currentMonthName);
      const targetMonthIdx = monthNames.indexOf(targetMonthName);
      
      let navTarget = 'V4321'; // Default Prev
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
        headers: { 
          ...commonHeaders,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookies.join('; '),
          'X-MicrosoftAjax': 'Delta=true',
        },
        body: bodyNav.toString()
      });

      const deltaHtmlNav = await respNav.text();
      html = deltaHtmlNav; // Atualiza o HTML para a próxima iteração
      hiddenFields = updateFields(deltaHtmlNav, hiddenFields);
      
      let navCookies: string[] = [];
      if (typeof respNav.headers.getSetCookie === 'function') {
        navCookies = respNav.headers.getSetCookie();
      } else {
        const setCookie = respNav.headers.get('set-cookie');
        if (setCookie) navCookies = [setCookie];
      }
      if (navCookies.length > 0) cookies = navCookies;

      // Re-checa o título
      calendarTitleRegex.lastIndex = 0;
      titleMatch = calendarTitleRegex.exec(deltaHtmlNav);
      if (titleMatch) {
        currentMonthName = titleMatch[1].toLowerCase();
        currentYearStr = titleMatch[2];
      } else {
        // Se não achou o título no Delta, tenta extrair do conteúdo
        const titleFallbackRegex = /\|content\|([^|]*?([a-zç]+)\s+de\s+(\d{4})[^|]*?)\|/gi;
        const fallbackMatch = titleFallbackRegex.exec(deltaHtmlNav);
        if (fallbackMatch) {
          currentMonthName = fallbackMatch[2].toLowerCase();
          currentYearStr = fallbackMatch[3];
        }
      }
      console.log(`[Fetch] Agora no portal: ${currentMonthName} ${currentYearStr}`);
    }

    const calendarArgs = extractCalendarArguments(html, month);
    const daysToFetch = Object.keys(calendarArgs).map(Number).sort((a, b) => a - b);

    if (daysToFetch.length === 0) {
      console.warn("[Fetch] Calendário não encontrado no HTML após navegação");
      throw new Error("Não foi possível localizar o calendário para o mês solicitado.");
    }

    const today = new Date();
    const isPastMonth = year < today.getFullYear() || (year === today.getFullYear() && month < (today.getMonth() + 1));
    const lastDayToFetch = isPastMonth ? 31 : today.getDate();

    console.log(`[Fetch] Dias para buscar: ${daysToFetch.length}, Limite: ${lastDayToFetch}`);

    // Loop por todos os dias do mês
    for (const day of daysToFetch) {
      if (day > lastDayToFetch) break;

      console.log(`[Fetch] Buscando dia ${day}...`);
      const dayArg = calendarArgs[day];
      
      // PASSO 1: Selecionar o dia
      const bodyDay = new URLSearchParams();
      Object.entries(hiddenFields).forEach(([k, v]) => bodyDay.append(k, v));
      bodyDay.set('__EVENTTARGET', 'Calendar');
      bodyDay.set('__EVENTARGUMENT', dayArg);
      bodyDay.set('txtMatricula', matricula);
      bodyDay.set('ScriptManager1', 'UpdatePanel1|Calendar');

      const controllerDay = new AbortController();
      const timeoutDay = setTimeout(() => controllerDay.abort(), 15000);

      const respDay = await fetch(TARGET_URL, {
        method: 'POST',
        headers: { 
          ...commonHeaders,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookies.join('; '),
          'X-MicrosoftAjax': 'Delta=true',
        },
        body: bodyDay.toString(),
        signal: controllerDay.signal
      });
      clearTimeout(timeoutDay);
      
      const deltaHtmlDay = await respDay.text();
      hiddenFields = updateFields(deltaHtmlDay, hiddenFields);
      
      let newCookies: string[] = [];
      if (typeof respDay.headers.getSetCookie === 'function') {
        newCookies = respDay.headers.getSetCookie();
      } else {
        const setCookie = respDay.headers.get('set-cookie');
        if (setCookie) newCookies = [setCookie];
      }
      if (newCookies.length > 0) cookies = newCookies;

      // PASSO 2: Consultar horários
      const bodyConsultar = new URLSearchParams();
      Object.entries(hiddenFields).forEach(([k, v]) => bodyConsultar.append(k, v));
      bodyConsultar.set('__EVENTTARGET', 'btnConsultar');
      bodyConsultar.set('txtMatricula', matricula);
      bodyConsultar.set('ScriptManager1', 'UpdatePanel1|btnConsultar');

      const controllerFinal = new AbortController();
      const timeoutFinal = setTimeout(() => controllerFinal.abort(), 15000);

      const respFinal = await fetch(TARGET_URL, {
        method: 'POST',
        headers: { 
          ...commonHeaders,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookies.join('; '),
          'X-MicrosoftAjax': 'Delta=true',
        },
        body: bodyConsultar.toString(),
        signal: controllerFinal.signal
      });
      clearTimeout(timeoutFinal);
      
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
    return { success: true, data: results };
  } catch (error: any) {
    console.error("Erro na extração:", error);
    return { success: false, error: error.message || "Falha de comunicação com o portal." };
  }
}
