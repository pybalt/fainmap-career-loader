// Tipos y enums
enum CorrelativeType {
  WEAK = 'weak',
  STRONG = 'strong'
}

interface Subject {
  id: string;
  code: string;
  name: string;
  correlatives: {
    weak: Array<{
      code: string;
      name?: string;
    }>;
    strong: Array<{
      code: string;
      name?: string;
    }>;
  };
  semester: number;
  year: number;
  isOptional: boolean;
}

interface Career {
  id: string;
  name: string;
  faculty: {
    id: string;
    name: string;
  };
  plan: {
    id: string;
    year: string;
  };
  subjects: Subject[];
  totalYears: number;
}

export interface Env {
  // Define your environment variables here
}

type ExecutionContext = {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
};

// Funciones auxiliares
function extractNumberFromText(text: string): number {
  const match = text.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function parseCorrelatives(text: string): { code: string; name?: string }[] {
  if (!text || text.includes('No posee')) return [];
  
  return text.split(',')
    .map(item => {
      const parts = item.trim().split('-').map(p => p.trim());
      return {
        code: parts[0],
        name: parts.length > 1 ? parts[1] : undefined
      };
    })
    .filter(item => item.code);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Configurar CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    try {
      const url = new URL(request.url);
      const htmlContent = await request.text();
      
      if (!htmlContent) {
        throw new Error('El contenido HTML está vacío');
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');

      // Validar que el documento se parseó correctamente
      if (!doc || !doc.querySelector('body')) {
        throw new Error('Error al parsear el HTML');
      }

      // Extraer información de la carrera
      const titleElement = doc.querySelector('#ctl00_ContentPlaceHolderMain_lbl_TituloCarrera');
      const careerName = normalizeText(titleElement?.textContent || 'Carrera Desconocida');
      
      // Obtener IDs desde la URL o el HTML
      const careerIdMatch = url.searchParams.get('IdCarrera') || 
                           htmlContent.match(/IdCarrera=(\d+)/i)?.[1];
      const careerId = careerIdMatch || 'unknown';

      const facultyIdMatch = url.searchParams.get('IdFacultad') || 
                           htmlContent.match(/IdFacultad=(\d+)/i)?.[1];
      
      const faculty = {
        id: facultyIdMatch || 'unknown',
        name: `Facultad ${facultyIdMatch || 'Desconocida'}`
      };

      // Obtener información del plan
      const planInfoElement = doc.querySelector('.TablaTitFACU1');
      const planInfoMatch = planInfoElement?.textContent?.match(/Plan:\s*(\d+)\s*-\s*Año:\s*(\d+)/);
      const plan = {
        id: planInfoMatch?.[1] || 'unknown',
        year: planInfoMatch?.[2] || 'unknown'
      };

      const subjects: Subject[] = [];
      let currentYear = 1;
      let currentSemester = 1;
      let maxYear = 1;

      // Procesar cada fila de la tabla
      const table = doc.querySelector('#ctl00_ContentPlaceHolderMain_tbl_Materias');
      if (!table) {
        throw new Error('No se encontró la tabla de materias');
      }

      const rows = table.querySelectorAll('tr');
      
      rows.forEach((row) => {
        // Detectar cambio de año
        const yearCell = row.querySelector('.yearFACU1');
        if (yearCell?.textContent?.includes('° Año')) {
          currentYear = extractNumberFromText(yearCell.textContent);
          maxYear = Math.max(maxYear, currentYear);
          currentSemester = 0;
          return;
        }

        // Detectar cambio de cuatrimestre
        const semesterCell = row.querySelector('.cuatrimestreFACU1');
        if (semesterCell?.textContent?.includes('° Cuatrimestre')) {
          currentSemester = extractNumberFromText(semesterCell.textContent);
          return;
        }

        const cells = row.querySelectorAll('td');
        if (cells.length >= 3 && !row.querySelector('.TablaCampos')) {
          const code = normalizeText(cells[0]?.textContent || '');
          const name = normalizeText(cells[1]?.textContent || '');
          
          // Detectar si es materia optativa
          const isOptional = name.toLowerCase().includes('optativa');
          
          // Obtener el ID de la materia
          const detailButton = cells[2]?.querySelector('input[type="image"]');
          const onClickAttr = detailButton?.getAttribute('onclick') || '';
          const idMatch = onClickAttr.match(/'([^']+)1'/);
          const id = idMatch?.[1] || code;

          if (code && name) {
            // Buscar correlativas en el div correspondiente
            const correlativesDiv = doc.querySelector(`#ctl00_ContentPlaceHolderMain_${id}1`);
            const correlativesData = {
              weak: [] as Array<{ code: string; name?: string }>,
              strong: [] as Array<{ code: string; name?: string }>
            };

            if (correlativesDiv) {
              const correlativesText = correlativesDiv.textContent || '';
              
              // Buscar correlativas en las diferentes secciones
              const sections = correlativesDiv.querySelectorAll('.yearFACU1');
              sections.forEach(section => {
                const sectionTitle = section.textContent?.trim().toLowerCase() || '';
                const nextDiv = section.nextElementSibling;
                const correlativesContent = nextDiv?.textContent?.trim() || '';

                if (sectionTitle.includes('anteriores')) {
                  correlativesData.strong = parseCorrelatives(correlativesContent);
                } else if (sectionTitle.includes('posteriores')) {
                  // Podríamos guardar las correlativas posteriores si es necesario
                }
              });
            }

            subjects.push({
              id,
              code,
              name,
              correlatives: correlativesData,
              semester: currentSemester,
              year: currentYear,
              isOptional
            });
          }
        }
      });

      // Ordenar materias por año y semestre
      subjects.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.semester - b.semester;
      });

      const career: Career = {
        id: careerId,
        name: careerName,
        faculty,
        plan,
        subjects,
        totalYears: maxYear
      };

      return new Response(JSON.stringify(career), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      return new Response(JSON.stringify({ 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
}; 