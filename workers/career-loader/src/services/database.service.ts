import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Career, Subject, Env } from '../types';

// Tipos para manejar las respuestas de Supabase
interface SupabaseResult {
  data: any;
  error: any;
}

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor(url: string, apiKey: string) {
    this.supabase = createClient(url, apiKey);
  }

  static fromEnv(env: Env): DatabaseService | null {
    if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
      console.warn('No se pueden obtener las credenciales de Supabase desde variables de entorno');
      return null;
    }

    return new DatabaseService(env.SUPABASE_URL, env.SUPABASE_KEY);
  }

  async saveCareer(career: Career): Promise<{ success: boolean; message: string; stats: any }> {
    // Verificar si el objeto es seguro para guardar
    if (!career.safe) {
      console.warn('Se intentó guardar una carrera no marcada como segura:', career.id, career.name);
      return {
        success: false,
        message: 'El objeto de carrera no está marcado como seguro para guardar en la base de datos',
        stats: { timestamp: new Date().toISOString() }
      };
    }

    console.log('Iniciando guardado de carrera:', career.id, career.name);
    console.log('Estado de seguridad de la carrera:', career.safe);

    // Preparar todos los datos en memoria antes de hacer peticiones a la base de datos
    const careerId = parseInt(career.id);
    console.log('ID de carrera a procesar:', careerId);
    
    // 1. Información de la carrera
    const careerData = {
      careerid: careerId,
      name: career.name,
      facultyid: career.faculty.id ? parseInt(career.faculty.id) : null
    };
    
    console.log('Datos de carrera preparados:', careerData);
    
    // 2. Información del plan (si existe)
    const planData = career.plan.id && career.plan.year ? {
      careerid: careerId,
      plan_id: career.plan.id,
      plan_year: career.plan.year
    } : null;
    
    console.log('Datos de plan preparados:', planData);
    
    // 3. Información de materias
    const validSubjects = career.subjects.filter(s => s.id && s.code && s.name);
    console.log(`Materias válidas: ${validSubjects.length} de ${career.subjects.length}`);
    
    const subjectsData = validSubjects.map(s => ({
      subjectid: parseInt(s.id.replace(/\D/g, '')),
      code: s.code,
      name: s.name
    }));
    
    // Mostrar algunas materias de ejemplo
    console.log('Ejemplo de materias preparadas:', subjectsData.slice(0, 2));
    
    // 4. Relaciones carrera-materia
    const careerSubjectsData = validSubjects.map(s => ({
      careerid: careerId,
      subjectid: parseInt(s.id.replace(/\D/g, '')),
      suggested_year: s.year,
      suggested_quarter: s.semester
    }));

    // Crear colección para errores
    const errors: any[] = [];
    
    // Verificar conexión con Supabase
    return this.checkConnection()
      .then(isConnected => {
        if (!isConnected) {
          throw new Error('No se pudo establecer conexión con la base de datos');
        }
        console.log('Conexión con Supabase verificada');
        
        // 1. Insertar carrera
        console.log('Insertando carrera...');
        return this.supabase
          .from('careers')
          .upsert(careerData)
          .select();
      })
      .then((careerResult: SupabaseResult) => {
        console.log('Resultado inserción carrera:', careerResult.data);
        if (careerResult.error) {
          console.error('Error al guardar carrera:', careerResult.error);
          errors.push(careerResult.error);
        }
        
        // 2. Insertar plan (si existe)
        if (planData) {
          console.log('Insertando plan...');
          return this.supabase
            .from('career_plans')
            .upsert(planData)
            .select();
        }
        return { data: null, error: null } as SupabaseResult;
      })
      .then((planResult: SupabaseResult) => {
        if (planResult.error) {
          console.error('Error al guardar plan:', planResult.error);
          errors.push(planResult.error);
        }
        
        // 3. Insertar materias
        if (subjectsData.length > 0) {
          console.log(`Insertando ${subjectsData.length} materias...`);
          return this.supabase
            .from('subjects')
            .upsert(subjectsData)
            .select();
        }
        return { data: null, error: null } as SupabaseResult;
      })
      .then((subjectsResult: SupabaseResult) => {
        if (subjectsResult.error) {
          console.error('Error al guardar materias:', subjectsResult.error);
          errors.push(subjectsResult.error);
          throw new Error('Error al guardar materias');
        }
        
        console.log(`Materias insertadas: ${subjectsResult.data ? subjectsResult.data.length : 0}`);
        
        // 4. Insertar relaciones carrera-materia
        if (careerSubjectsData.length > 0) {
          console.log(`Insertando ${careerSubjectsData.length} relaciones carrera-materia...`);
          return this.supabase
            .from('career_subjects')
            .upsert(careerSubjectsData)
            .select();
        }
        return { data: null, error: null } as SupabaseResult;
      })
      .then(async (relationsResult: SupabaseResult) => {
        if (relationsResult.error) {
          console.error('Error al guardar relaciones:', relationsResult.error);
          errors.push(relationsResult.error);
        }
        
        console.log(`Relaciones insertadas: ${relationsResult.data ? relationsResult.data.length : 0}`);
        
        // 5. Procesar correlativas solo si no hay errores
        if (errors.length === 0) {
          console.log('Procesando correlativas...');
          await this.processPrerequistesInBulk(career, validSubjects);
        }
        
        return {
          success: errors.length === 0,
          message: errors.length === 0 
            ? 'Datos guardados correctamente' 
            : 'Algunos datos no pudieron guardarse correctamente',
          stats: {
            totalSubjects: career.subjects.length,
            validSubjects: validSubjects.length,
            correlatives: this.countCorrelatives(validSubjects),
            errors: errors.length,
            errorDetails: errors.length > 0 ? errors : undefined,
            timestamp: new Date().toISOString()
          }
        };
      })
      .catch(error => {
        console.error('Error fatal en el flujo de guardado:', error);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Error desconocido en el proceso de guardado',
          stats: { 
            error: error instanceof Error ? error.stack : String(error),
            timestamp: new Date().toISOString() 
          }
        };
      });
  }
  
  // Método auxiliar para verificar la conexión
  private async checkConnection(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('careers')
        .select('count')
        .limit(1);
      
      if (error) {
        console.error('Error al verificar conexión con Supabase:', error);
        return false;
      }
      
      console.log('Conexión con Supabase exitosa:', data);
      return true;
    } catch (error) {
      console.error('Error grave al verificar conexión:', error);
      return false;
    }
  }
  
  private countCorrelatives(subjects: Subject[]): number {
    return subjects.reduce((count, subject) => 
      count + (subject.correlatives.previous?.length || 0), 0);
  }
  
  private async processPrerequistesInBulk(career: Career, subjects: Subject[]): Promise<void> {
    if (subjects.length === 0) {
      console.log('No hay materias válidas para procesar correlativas');
      return;
    }
    
    try {
      // 1. Obtener todos los códigos e IDs de materias de una sola vez
      const allCodes = new Set<string>();
      
      // Agregar códigos de todas las materias y sus correlativas
      subjects.forEach(subject => {
        allCodes.add(subject.code);
        subject.correlatives.previous.forEach(c => {
          if (c.code) allCodes.add(c.code);
        });
      });
      
      console.log(`Consultando ${allCodes.size} códigos de materias para correlativas...`);
      
      const { data: subjectsData, error: subjectsQueryError } = await this.supabase
        .from('subjects')
        .select('subjectid, code')
        .in('code', Array.from(allCodes));
      
      if (subjectsQueryError) {
        console.error('Error al consultar materias para correlativas:', subjectsQueryError);
        return;
      }
      
      if (!subjectsData || subjectsData.length === 0) {
        console.warn('No se encontraron materias para establecer correlativas');
        return;
      }
      
      console.log(`Se encontraron ${subjectsData.length} materias de ${allCodes.size} códigos buscados`);
      
      // Crear un mapa para búsqueda rápida
      const codeToId = new Map<string, number>();
      subjectsData.forEach(s => codeToId.set(s.code, s.subjectid));
      
      // 2. Preparar todas las correlativas en una sola operación
      const prerequisitesData = [];
      const careerId = parseInt(career.id);
      
      // Contar correlativas disponibles para diagnosticar posibles problemas
      let correlativesFound = 0;
      let correlativesMissing = 0;
      let subjectsMissing = 0;
      
      for (const subject of subjects) {
        const subjectId = codeToId.get(subject.code);
        if (!subjectId) {
          console.warn(`No se encontró el ID para la materia ${subject.code}`);
          subjectsMissing++;
          continue;
        }
        
        for (const correlative of subject.correlatives.previous) {
          if (!correlative.code) continue;
          
          const correlativeId = codeToId.get(correlative.code);
          if (!correlativeId) {
            console.warn(`No se encontró el ID para la correlativa ${correlative.code} de la materia ${subject.code}`);
            correlativesMissing++;
            continue;
          }
          
          correlativesFound++;
          
          prerequisitesData.push({
            careerid: careerId,
            subjectid: subjectId,
            prerequisite_subjectid: correlativeId
          });
        }
      }
      
      console.log(`Estadísticas de correlativas: 
        Encontradas: ${correlativesFound},
        No encontradas: ${correlativesMissing},
        Materias no encontradas: ${subjectsMissing}`);
      
      // 3. Insertar todas las correlativas de una vez
      if (prerequisitesData.length > 0) {
        console.log(`Intentando guardar ${prerequisitesData.length} correlativas...`);
        
        const { data: prereqResponseData, error: prereqError } = await this.supabase
          .from('prerequisites')
          .upsert(prerequisitesData)
          .select();
        
        if (prereqError) {
          console.error('Error al guardar correlativas:', prereqError);
        } else {
          console.log(`Correlativas guardadas exitosamente:`, 
            prereqResponseData ? `${prereqResponseData.length} registros` : 'Sin detalle de respuesta');
        }
      } else {
        console.log('No hay correlativas para guardar');
      }
    } catch (error) {
      console.error('Error al procesar correlativas:', error);
    }
  }
} 