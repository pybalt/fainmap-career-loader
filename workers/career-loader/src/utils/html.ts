import { Subject, CorrelativeType } from '../types';

export function extractCareerName(doc: Document): string {
  const titleElement = doc.querySelector('#ctl00_ContentPlaceHolderMain_lbl_TituloCarrera');
  return titleElement?.textContent?.trim() || '';
}

export function extractPlanInfo(doc: Document): { id: string; year: string } {
  const planHeader = doc.querySelector('table.tabla-contenido th');
  const planText = planHeader?.textContent || '';
  const planMatch = planText.match(/Plan:\s*(\d+)\s*\((\d+)\)/);
  
  return {
    id: planMatch?.[1] || '',
    year: planMatch?.[2] || ''
  };
}

export function extractSubjects(doc: Document): Subject[] {
  const subjects: Subject[] = [];
  const rows = Array.from(doc.querySelectorAll('table.tabla-contenido tr'));
  
  let currentYear = 1;
  let currentSemester = 1;
  
  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll('td'));
    
    // Check if this is a year header row
    const yearHeader = row.querySelector('th');
    if (yearHeader) {
      const yearMatch = yearHeader.textContent?.match(/(\d+)º\s*AÑO/i);
      if (yearMatch) {
        currentYear = parseInt(yearMatch[1]);
        currentSemester = 1;
        continue;
      }
    }
    
    if (cells.length >= 3) {
      const code = cells[0]?.textContent?.trim() || '';
      const name = cells[1]?.textContent?.trim() || '';
      const correlativesCell = cells[2];
      
      if (code && name) {
        const correlatives = {
          weak: extractCorrelatives(correlativesCell, CorrelativeType.WEAK),
          strong: extractCorrelatives(correlativesCell, CorrelativeType.STRONG)
        };
        
        subjects.push({
          id: code,
          code,
          name,
          correlatives,
          year: currentYear,
          semester: currentSemester,
          isOptional: name.toLowerCase().includes('optativa')
        });
      }
    }
    
    // Update semester counter if we found a subject
    if (cells.length >= 3) {
      currentSemester = currentSemester === 1 ? 2 : 1;
    }
  }
  
  return subjects;
}

function extractCorrelatives(cell: Element | null, type: CorrelativeType): Array<{ code: string; name?: string }> {
  if (!cell) return [];
  
  const correlatives: Array<{ code: string; name?: string }> = [];
  const selector = type === CorrelativeType.WEAK ? '.correlativa-debil' : '.correlativa-fuerte';
  
  cell.querySelectorAll(selector).forEach((el) => {
    const code = el.textContent?.trim() || '';
    if (code) {
      correlatives.push({ code });
    }
  });
  
  return correlatives;
} 