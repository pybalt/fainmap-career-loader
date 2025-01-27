import { Career, Subject, CorrelativeType } from '../types';

// Interfaces para el manejo de correlativas
interface CorrelativeRelation {
  subjectCode: string;
  correlativeCode: string;
  type: 'previous' | 'next';
}

interface ElementHandler {
  element(element: Element): void;
}

interface TextHandler {
  text(text: { text: string }): void;
}

export class CareerService {
  static async processHtml(html: string, url: string): Promise<Career> {
    // 1. Procesar el HTML base sin correlativas
    const career = await this.processBasicHtml(html);
    
    // 2. Extraer y procesar las relaciones de correlatividad
    const relations = this.extractCorrelativeRelations(html);
    
    // Debug: Mostrar las relaciones extraídas
    console.log('Relaciones extraídas:', relations);
    
    // 3. Validar y aplicar las relaciones
    this.applyCorrelativeRelations(career, relations);
    
    return career;
  }

  private static async processBasicHtml(html: string): Promise<Career> {
    const career: Career = {
      id: '',
      name: '',
      faculty: {
        id: '',
        name: ''
      },
      plan: {
        id: '',
        year: ''
      },
      subjects: [],
      totalYears: 0
    };

    // Mantener el código existente de procesamiento HTML pero sin procesar correlativas
    const response = new Response(html) as unknown as Response;
    let currentYear = 1;
    let currentSemester = 1;
    let currentSubject: Partial<Subject> | null = null;

    // Primero extraemos el ID de la facultad y su nombre
    const formRewriter = new HTMLRewriter()
      .on('form#aspnetForm', {
        element(element: Element) {
          const action = element.getAttribute('action') || '';
          const urlParams = new URLSearchParams(action.split('?')[1]);
          career.id = urlParams.get('IdCarrera') || '';
          career.faculty.id = urlParams.get('IdFacultad') || '';
        }
      })
      .on('#ctl00_ContentPlaceHolderMain_lbl_TituloFacultad, #ctl00_ContentPlaceHolderMain_lblTituloFacultad', {
        text(text: { text: string }) {
          if (text.text.trim()) {
            career.faculty.name = text.text.trim();
          }
        }
      });

    await formRewriter.transform(new Response(html) as unknown as Response).text();

    const rewriter = new HTMLRewriter()
      .on('#ctl00_ContentPlaceHolderMain_lbl_TituloCarrera', {
        text(text: { text: string }) {
          career.name = (career.name + text.text).trim();
        }
      })
      .on('[class^="TablaTitFACU"]', {
        text(text: { text: string }) {
          const planMatch = text.text.match(/Plan:\s*(\d+)\s*-\s*Año:\s*(\d+)/);
          if (planMatch) {
            career.plan.id = planMatch[1];
            career.plan.year = planMatch[2];
          }
        }
      })
      .on('[class^="yearFACU"]', {
        text(text: { text: string }) {
          const yearMatch = text.text.match(/(\d+)°\s*Año/i);
          if (yearMatch) {
            currentYear = parseInt(yearMatch[1]);
            currentSemester = 1;
          }
        }
      })
      .on('[class^="cuatrimestreFACU"]', {
        text(text: { text: string }) {
          const semesterMatch = text.text.match(/(\d+)°\s*Cuatrimestre/i);
          if (semesterMatch) {
            currentSemester = parseInt(semesterMatch[1]);
          }
        }
      })
      .on('.materias2', {
        text(text: { text: string }) {
          const code = text.text.trim();
          if (code && code !== 'Código') {
            currentSubject = {
              id: code,
              code,
              name: '',
              correlatives: {
                previous: [],
                next: []
              },
              year: currentYear,
              semester: currentSemester,
              isOptional: false
            };
          }
        }
      })
      .on('.materias', {
        text(text: { text: string }) {
          if (currentSubject) {
            currentSubject.name = text.text.trim();
            currentSubject.isOptional = text.text.toLowerCase().includes('optativa');
            if (currentSubject.code && currentSubject.name) {
              career.subjects.push(currentSubject as Subject);
              currentSubject = null;
            }
          }
        }
      });

    await rewriter.transform(response).text();
    
    career.totalYears = career.subjects.length > 0 ? Math.max(...career.subjects.map(s => s.year)) : 0;
    
    return career;
  }

  private static extractCorrelativeRelations(html: string): CorrelativeRelation[] {
    const correlativeRelations: CorrelativeRelation[] = [];
    const scriptMatch = html.match(/function CreateTree\(\) \{([\s\S]*?)\}CreateTree\(\);/);
    
    if (scriptMatch) {
      const treeScript = scriptMatch[1];
      const trees = Array.from(treeScript.matchAll(/t = new ECOTree\('t','(Arbol|ArbolAnt)([^']+)'\);([\s\S]*?)t\.UpdateTree/g));
      
      for (const [, treeType, subjectCode, treeContent] of trees) {
        const treeRelations = Array.from(treeContent.matchAll(/t\.add\((\d+),(-?\d+),"([^"]+)"/g));
        
        // Mapear IDs a códigos
        const idToCode = new Map<string, string>();
        treeRelations.forEach(([, id, , code]) => {
          idToCode.set(id, code.trim());
        });
        
        treeRelations.forEach(([, id, parentId]) => {
          if (parentId === '-1') return;
          
          const currentCode = idToCode.get(id)!;
          const parentCode = idToCode.get(parentId)!;
          
          if (currentCode === parentCode) return;
          
          if (treeType === 'ArbolAnt') {
            // En árbol anterior, el nodo actual tiene como correlativa previa al padre
            correlativeRelations.push({
              subjectCode: currentCode,
              correlativeCode: parentCode,
              type: 'previous'  // Invertido: el padre es correlativa posterior
            });
          } else {
            // En árbol normal, el padre tiene como correlativa previa al nodo actual
            correlativeRelations.push({
              subjectCode: parentCode,
              correlativeCode: currentCode,
              type: 'next'  // El nodo actual es correlativa previa del padre
            });
          }
        });
      }
    }
    
    return correlativeRelations;
  }

  private static applyCorrelativeRelations(career: Career, relations: CorrelativeRelation[]): void {
    const relationMap = new Map<string, Set<string>>();
    
    // Inicializar el mapa
    career.subjects.forEach(subject => {
      relationMap.set(`${subject.code}_prev`, new Set());
      relationMap.set(`${subject.code}_next`, new Set());
    });
    const hasCircularDependency = (source: string, target: string): boolean => {
      const visited = new Set<string>();
      const queue = [target];
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === source) return true;
        
        const nextRelations = relationMap.get(`${current}_next`);
        if (nextRelations) {
          nextRelations.forEach(code => {
            if (!visited.has(code)) {
              visited.add(code);
              queue.push(code);
            }
          });
        }
      }
      return false;
    };
    // Primera pasada: validar y registrar relaciones
    relations.forEach(relation => {
      const subject = career.subjects.find(s => s.code === relation.subjectCode);
      const correlative = career.subjects.find(s => s.code === relation.correlativeCode);
      
      if (!subject || !correlative) return;
  
      // Validación 1: Relaciones directas
      const existingRelations = [
        relationMap.get(`${relation.subjectCode}_prev`)?.has(relation.correlativeCode),
        relationMap.get(`${relation.subjectCode}_next`)?.has(relation.correlativeCode),
        relationMap.get(`${relation.correlativeCode}_prev`)?.has(relation.subjectCode),
        relationMap.get(`${relation.correlativeCode}_next`)?.has(relation.subjectCode)
      ];
  
      if (existingRelations.some(Boolean)) {
        console.warn(`Relación inválida: ${relation.subjectCode} <-> ${relation.correlativeCode}`);
        return;
      }
  
      // Validación 2: Dependencias circulares
      if (hasCircularDependency(relation.subjectCode, relation.correlativeCode)) {
        console.warn(`Dependencia circular: ${relation.subjectCode} -> ${relation.correlativeCode}`);
        return;
      }
  
      // Agregar relaciones válidas
      if (relation.type === 'previous') {
        relationMap.get(`${relation.subjectCode}_prev`)?.add(relation.correlativeCode);
        relationMap.get(`${relation.correlativeCode}_next`)?.add(relation.subjectCode);
      } else {
        relationMap.get(`${relation.subjectCode}_next`)?.add(relation.correlativeCode);
        relationMap.get(`${relation.correlativeCode}_prev`)?.add(relation.subjectCode);
      }
    });
  
    // Segunda pasada: aplicar las relaciones validadas
    career.subjects.forEach(subject => {
      const prevSet = relationMap.get(`${subject.code}_prev`);
      const nextSet = relationMap.get(`${subject.code}_next`);
  
      if (prevSet) {
        subject.correlatives.previous = Array.from(prevSet).map(code => {
          const correlative = career.subjects.find(s => s.code === code);
          return {
            code,
            name: correlative?.name || ''
          };
        });
      }
  
      if (nextSet) {
        subject.correlatives.next = Array.from(nextSet).map(code => {
          const correlative = career.subjects.find(s => s.code === code);
          return {
            code,
            name: correlative?.name || ''
          };
        });
      }
    });
  }
}