import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Career, Subject, Env } from '../types';

// Tipos para manejar las respuestas de Supabase
interface SupabaseResult {
  data: any;
  error: any;
}

// Interfaces para los tipos de retorno
interface SaveCareerResponse {
  success: boolean;
  message: string;
  stats: {
    totalSubjects?: number;
    validSubjects?: number;
    correlatives?: number;
    errors?: number;
    errorDetails?: any[];
    timestamp: string;
    [key: string]: any;
  };
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

  async saveCareer(career: Career): Promise<SupabaseResult | { success: boolean; message: string; stats: any }> {
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
      code: s.code,
      name: s.name
    }));
    
    // Mostrar algunas materias de ejemplo
    console.log('Ejemplo de materias preparadas:', subjectsData.slice(0, 2));
    
    // No creamos ahora las relaciones carrera-materia porque necesitamos primero los IDs reales
    // Estas se crearán después de obtener los subjects insertados

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
            .upsert(subjectsData, { onConflict: 'code', ignoreDuplicates: true })
            .select();
        }
        return { data: null, error: null } as SupabaseResult;
      })
      .then((subjectsResult: SupabaseResult) => {
        if (subjectsResult.error) {
          console.error('Error al guardar subjects:', subjectsResult.error);
          
          // Si es un error de clave duplicada, intentamos recuperar las materias existentes
          if (subjectsResult.error.code === '23505') {
            console.log('Detectada colisión de materias, obteniendo materias existentes...');
            // Extraer códigos de materia para consultar
            const subjectCodes = subjectsData.map((s: any) => s.code);
            
            // Consultar materias existentes por código
            return this.buscarMateriasPorCodigo(subjectCodes)
              .then(existingSubjectsResult => {
                if (existingSubjectsResult.error) {
                  console.error('Error al recuperar materias existentes:', existingSubjectsResult.error);
                  return Promise.resolve({ data: null, error: existingSubjectsResult.error } as SupabaseResult);
                }
                
                console.log(`Recuperadas ${existingSubjectsResult.data?.length || 0} materias existentes`);
                return Promise.resolve({ 
                  data: existingSubjectsResult.data, 
                  error: null 
                } as SupabaseResult);
              });
          }
          
          return Promise.resolve({ data: null, error: subjectsResult.error } as SupabaseResult);
        }

        // Log cuántos subjects se insertaron realmente
        console.log(`Subjects guardados correctamente. Datos retornados:`, 
          subjectsResult.data ? `${subjectsResult.data.length} registros` : 'Sin datos');
        
        // Diagnóstico completo de los datos retornados
        console.log('Estructura completa de datos retornados por Supabase:');
        console.log(JSON.stringify(subjectsResult, null, 2));

        // Verificar que subjects sean válidos antes de continuar
        if (!subjectsResult.data || subjectsResult.data.length === 0) {
          console.warn('No se insertaron subjects, saltando la inserción de career_subjects');
          return Promise.resolve({ 
            data: { career: career, subjectsInserted: 0, relationsInserted: 0 }, 
            error: null 
          } as SupabaseResult);
        }

        // 4. Procesar y guardar relaciones carrera-materia
        console.log(`Preparando relaciones carrera-materia para ${validSubjects.length} materias válidas...`);

        // Diagnóstico de las materias de entrada
        console.log('Códigos de materias originales:');
        validSubjects.forEach(s => console.log(`- ${s.code}`));

        // Diagnóstico de las materias retornadas
        console.log('Códigos de materias retornados por Supabase:');
        subjectsResult.data.forEach((s: any) => console.log(`- ${s.code} (ID: ${s.subjectid})`));

        // En mapear subjects con IDs
        const subjectIdMap = new Map<string, number>();
        console.log(`Datos recibidos de la consulta: ${subjectsResult.data.length} materias`);
        console.log('Primeros 3 registros de la consulta:', JSON.stringify(subjectsResult.data.slice(0, 3), null, 2));
        
        // Verificar si faltan materias
        const codigosInsertados = new Set(subjectsResult.data.map((s: any) => s.code));
        const materiasFaltantes = validSubjects.filter(s => !codigosInsertados.has(s.code));
        
        if (materiasFaltantes.length > 0) {
          console.warn(`Faltan ${materiasFaltantes.length} materias en la respuesta de Supabase:`);
          materiasFaltantes.forEach(s => console.warn(`- Falta: ${s.code} (${s.name})`));
          
          // Intentar una consulta directa para las materias faltantes
          console.log('Realizando consulta adicional para las materias faltantes...');
          
          // Cargamos primero las materias que sí tenemos
          subjectsResult.data.forEach((subject: any) => {
            console.log(`Mapeando code '${subject.code}' al ID ${subject.subjectid}`);
            subjectIdMap.set(subject.code, subject.subjectid);
          });
          
          // Ahora intentamos recuperar las materias faltantes
          const codigosFaltantes = materiasFaltantes.map(s => s.code);
          return this.buscarMateriasPorCodigo(codigosFaltantes)
            .then(materiasFaltantesResult => {
              if (materiasFaltantesResult.data && materiasFaltantesResult.data.length > 0) {
                console.log(`Recuperadas ${materiasFaltantesResult.data.length} materias adicionales`);
                
                // Agregar al mapa las materias recuperadas
                materiasFaltantesResult.data.forEach((subject: any) => {
                  console.log(`Mapeando code adicional '${subject.code}' al ID ${subject.subjectid}`);
                  subjectIdMap.set(subject.code, subject.subjectid);
                });
              } else {
                console.warn('No se pudieron recuperar las materias faltantes');
              }
              
              return this.continuarProcesamientoRelaciones(career, careerId, validSubjects, subjectIdMap, errors);
            });
        }
        
        // Asociamos cada código de materia con su ID real en la base de datos
        subjectsResult.data.forEach((subject: any) => {
          console.log(`Mapeando code '${subject.code}' al ID ${subject.subjectid}`);
          subjectIdMap.set(subject.code, subject.subjectid);
        });

        return this.continuarProcesamientoRelaciones(career, careerId, validSubjects, subjectIdMap, errors);
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
  
  /**
   * Cuenta el número total de correlativas en una lista de materias
   * @param subjects Lista de materias
   * @returns Número total de correlativas
   */
  private countCorrelatives(subjects: any[]): number {
    if (!subjects || !Array.isArray(subjects)) return 0;
    
    console.log(`Analizando correlativas de ${subjects.length} materias...`);
    
    // Revisar la estructura completa de las correlativas para diagnóstico
    for (let i = 0; i < Math.min(5, subjects.length); i++) {
      const subject = subjects[i];
      console.log(`Materia ${i+1} (código ${subject.code}, nombre: ${subject.name}):`);
      console.log('Estructura de correlativas:', JSON.stringify(subject.correlatives || {}, null, 2));
    }
    
    // Contamos materias con correlativas en el formato correcto
    let totalPrevious = 0;
    let totalNext = 0;
    let materiasConCorrelativasPrevias = 0;
    let materiasConCorrelativasNext = 0;
    
    for (const subject of subjects) {
      // Verificar si tiene correlativas en el formato objeto.previous/next
      if (subject.correlatives && typeof subject.correlatives === 'object') {
        // Contar correlativas previas (prerrequisitos)
        if (subject.correlatives.previous && Array.isArray(subject.correlatives.previous)) {
          const previousCount = subject.correlatives.previous.length;
          if (previousCount > 0) {
            totalPrevious += previousCount;
            materiasConCorrelativasPrevias++;
            console.log(`Materia ${subject.code} tiene ${previousCount} correlativas previas`);
          }
        }
        
        // Contar correlativas siguientes (para diagnóstico)
        if (subject.correlatives.next && Array.isArray(subject.correlatives.next)) {
          const nextCount = subject.correlatives.next.length;
          if (nextCount > 0) {
            totalNext += nextCount;
            materiasConCorrelativasNext++;
            console.log(`Materia ${subject.code} tiene ${nextCount} correlativas siguientes`);
          }
        }
      }
    }
    
    console.log(`Estadísticas de correlativas:
      - ${materiasConCorrelativasPrevias} materias tienen ${totalPrevious} correlativas previas (prerrequisitos)
      - ${materiasConCorrelativasNext} materias tienen ${totalNext} correlativas siguientes
      - Total: ${materiasConCorrelativasPrevias + materiasConCorrelativasNext} materias con algún tipo de correlativa`);
    
    // Retornamos solo el total de prerrequisitos (correlativas previas) que son los que procesamos
    return totalPrevious;
  }
  
  /**
   * Procesa las correlativas de las materias en lotes
   * @param career Objeto de carrera
   * @param subjects Lista de materias
   * @returns Objeto con resultado del procesamiento
   */
  private async processPrerequistesInBulk(career: any, subjects: any[]): Promise<SupabaseResult> {
    console.log(`Procesando correlativas para ${subjects.length} materias...`);
    
    // Si no hay materias, retornar éxito vacío
    if (!subjects || subjects.length === 0) {
      console.log('No hay materias para procesar correlativas');
      return {
        data: {
          success: true,
          message: 'No hay materias para procesar correlativas',
          stats: {
            timestamp: new Date().toISOString()
          }
        },
        error: null
      };
    }
    
    // Contar cuantas materias tienen correlativas
    const totalCorrelativas = this.countCorrelatives(subjects);
    console.log(`Total de correlativas a procesar: ${totalCorrelativas}`);
    
    if (totalCorrelativas === 0) {
      console.log('No hay correlativas para procesar');
      return {
        data: {
          success: true,
          message: 'No hay correlativas para procesar',
          stats: {
            timestamp: new Date().toISOString()
          }
        },
        error: null
      };
    }
    
    // Extraer códigos de materia para consultar
    const subjectCodes = subjects.map(s => s.code);
    console.log(`Consultando IDs para ${subjectCodes.length} códigos de materias...`);
    
    try {
      // Obtener IDs de materias desde la base de datos
      const { data: subjectsFromDB, error } = await this.supabase
        .from('subjects')
        .select('subjectid, code')
        .in('code', subjectCodes);
      
      if (error) {
        console.error('Error al consultar materias:', error);
        return {
          data: {
            success: false,
            message: 'Error al consultar materias para correlativas',
            stats: {
              error: error.message,
              timestamp: new Date().toISOString()
            }
          },
          error: error
        };
      }
      
      if (!subjectsFromDB || subjectsFromDB.length === 0) {
        console.error('No se encontraron materias en la base de datos');
        return {
          data: {
            success: false,
            message: 'No se encontraron materias en la base de datos',
            stats: {
              timestamp: new Date().toISOString()
            }
          },
          error: new Error('No se encontraron materias en la base de datos')
        };
      }
      
      // Mapear código de materia a ID
      const subjectMap = new Map();
      subjectsFromDB.forEach(s => subjectMap.set(s.code, s.subjectid));
      
      // Estadísticas para el log
      let correlativasEncontradas = 0;
      let correlativasFaltantes = 0;
      let materiasFaltantes = 0;
      
      // Procesar correlativas para cada materia
      const correlativesData = [];
      const careerId = career.id ? parseInt(career.id) : null;
      
      // Validar careerId
      if (!careerId) {
        console.error('Error: No se puede procesar correlativas sin un careerId válido');
        return {
          data: {
            success: false,
            message: 'No se puede procesar correlativas sin un careerId válido',
            stats: {
              timestamp: new Date().toISOString()
            }
          },
          error: new Error('careerId inválido para correlativas')
        };
      }
      
      for (const subject of subjects) {
        // Verificar si tiene el formato correcto de correlativas (objeto con previous)
        const hasCorrelatives = subject.correlatives && 
                             typeof subject.correlatives === 'object' && 
                             subject.correlatives.previous &&
                             Array.isArray(subject.correlatives.previous);
                             
        if (!hasCorrelatives) {
          continue;
        }
        
        const subjectId = subjectMap.get(subject.code);
        if (!subjectId) {
          console.warn(`Materia no encontrada para correlativas: ${subject.code}`);
          materiasFaltantes++;
          continue;
        }
        
        // Procesar cada correlativa previa (prerequisito)
        for (const prerequisite of subject.correlatives.previous) {
          const prerequisiteCode = prerequisite.code;
          
          if (!prerequisiteCode) {
            console.warn(`Correlativa sin código para materia ${subject.code}`);
            continue;
          }
          
          const prerequisiteId = subjectMap.get(prerequisiteCode);
          
          if (!prerequisiteId) {
            console.warn(`Correlativa no encontrada: ${prerequisiteCode} para materia ${subject.code}`);
            correlativasFaltantes++;
            continue;
          }
          
          correlativesData.push({
            subjectid: subjectId,
            prerequisite_subjectid: prerequisiteId,
            careerid: careerId
          });
          
          correlativasEncontradas++;
        }
      }
      
      console.log(`Estadísticas de correlativas:
        - Encontradas: ${correlativasEncontradas}
        - Correlativas faltantes: ${correlativasFaltantes}
        - Materias faltantes: ${materiasFaltantes}`);
      
      // Si no hay correlativas para insertar, retornar
      if (correlativesData.length === 0) {
        return {
          data: {
            success: true,
            message: 'No hay correlativas válidas para insertar',
            stats: {
              totalCorrelativas,
              correlativasEncontradas,
              correlativasFaltantes,
              materiasFaltantes,
              timestamp: new Date().toISOString()
            }
          },
          error: null
        };
      }
      
      // Insertar correlativas
      console.log(`Insertando ${correlativesData.length} correlativas...`);
      const { data: result, error: insertError } = await this.supabase
        .from('prerequisites')
        .upsert(correlativesData)
        .select();
      
      if (insertError) {
        console.error('Error al insertar correlativas:', insertError);
        return {
          data: {
            success: false,
            message: 'Error al insertar correlativas',
            stats: {
              totalCorrelativas,
              correlativasEncontradas,
              correlativasFaltantes,
              materiasFaltantes,
              timestamp: new Date().toISOString(),
              error: insertError.message
            }
          },
          error: insertError
        };
      }
      
      console.log(`Correlativas insertadas correctamente: ${result ? result.length : 0}`);
      return {
        data: {
          success: true,
          message: 'Correlativas insertadas correctamente',
          stats: {
            totalCorrelativas,
            correlativasEncontradas,
            correlativasFaltantes,
            materiasFaltantes,
            insertadas: result ? result.length : 0,
            timestamp: new Date().toISOString()
          }
        },
        error: null
      };
      
    } catch (error) {
      console.error('Error grave al procesar correlativas:', error);
      return {
        data: {
          success: false,
          message: 'Error grave al procesar correlativas',
          stats: {
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          }
        },
        error
      };
    }
  }

  private async insertCareerSubjectsInBatches(relationships: any[]): Promise<SupabaseResult> {
    const batchSize = 5;
    const totalBatches = Math.ceil(relationships.length / batchSize);
    const errors: any[] = [];
    let insertedCount = 0;

    console.log(`Procesando ${relationships.length} relaciones en ${totalBatches} lotes de tamaño ${batchSize}`);

    for (let i = 0; i < totalBatches; i++) {
      const batch = relationships.slice(i * batchSize, (i + 1) * batchSize);
      console.log(`Procesando lote ${i + 1} de ${totalBatches} con ${batch.length} relaciones...`);

      try {
        // Usar upsert directo ya que la función RPC no existe
        const { data: upsertResult, error: upsertError } = await this.supabase
          .from('career_subjects')
          .upsert(batch);
        
        if (upsertError) {
          console.error(`Error en upsert directo (lote ${i + 1}):`, upsertError);
          errors.push(upsertError);
          
          // Intentar insertar uno por uno como último recurso
          console.log(`Intentando insertar uno por uno en lote ${i + 1}...`);
          for (const relationship of batch) {
            try {
              const { error: singleError } = await this.supabase
                .from('career_subjects')
                .upsert(relationship);
              
              if (!singleError) {
                insertedCount++;
              } else {
                console.error(`Error en inserción individual:`, singleError);
                errors.push(singleError);
              }
            } catch (error) {
              console.error(`Error grave en inserción individual:`, error);
            }
          }
        } else {
          console.log(`Upsert directo exitoso para lote ${i + 1}`);
          insertedCount += batch.length;
        }
      } catch (error) {
        console.error(`Error grave en lote ${i + 1}:`, error);
        errors.push(error);
      }
      
      // Esperar un momento entre lotes para no sobrecargar Supabase
      if (i < totalBatches - 1) {
        console.log(`Esperando 100ms antes del siguiente lote...`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Proceso completo. Insertadas ${insertedCount} de ${relationships.length} relaciones`);
    
    return {
      data: { insertedCount, totalCount: relationships.length },
      error: errors.length > 0 ? errors : null
    };
  }

  /**
   * Busca materias por código directamente en la base de datos
   */
  private async buscarMateriasPorCodigo(codigos: string[]): Promise<SupabaseResult> {
    if (!codigos || codigos.length === 0) {
      return { data: [], error: null };
    }
    
    console.log(`Buscando ${codigos.length} materias por código...`);
    try {
      return await this.supabase
        .from('subjects')
        .select('subjectid, code, name')
        .in('code', codigos);
    } catch (error) {
      console.error('Error al buscar materias por código:', error);
      return { data: [], error };
    }
  }
  
  /**
   * Continúa el procesamiento de relaciones una vez que tenemos los IDs de materias
   */
  private continuarProcesamientoRelaciones(
    career: any, 
    careerId: number, 
    validSubjects: any[], 
    subjectIdMap: Map<string, number>, 
    errors: any[]
  ): Promise<SupabaseResult> {
    // Verificar que tenemos el careerId
    if (!careerId || isNaN(careerId)) {
      console.error('Error: careerId es inválido:', careerId);
      return Promise.resolve({
        data: null, 
        error: new Error(`careerId inválido: ${careerId}`)
      } as SupabaseResult);
    }

    // AHORA generamos las relaciones usando los IDs reales de la DB
    const careerSubjectsData = validSubjects
      .filter(subject => {
        const hasId = subjectIdMap.has(subject.code);
        if (!hasId) {
          console.warn(`Advertencia: No se encontró ID para subject code ${subject.code}`);
        }
        return hasId;
      })
      .map(subject => {
        const subjectId = subjectIdMap.get(subject.code);
        return {
          careerid: careerId,
          subjectid: subjectId,
          suggested_year: subject.year || 1,
          suggested_quarter: subject.semester || 1,
          is_optional: subject.isOptional || false
        };
      });

    console.log(`Se prepararon ${careerSubjectsData.length} relaciones carrera-materia`);
    
    // Verificar si hay relaciones para insertar
    if (careerSubjectsData.length === 0) {
      console.warn('No hay relaciones carrera-materia para insertar');
      return Promise.resolve({ 
        data: { career: career, subjectsInserted: validSubjects.length, relationsInserted: 0 },
        error: null 
      } as SupabaseResult);
    }

    // Mostrar un ejemplo de la estructura de datos que se va a insertar
    console.log('Estructura de ejemplo de relación carrera-materia:', 
      JSON.stringify(careerSubjectsData[0], null, 2));

    // Proceder con la inserción en lotes
    return this.insertCareerSubjectsInBatches(careerSubjectsData)
      .then((relationsResult: SupabaseResult) => {
        if (relationsResult.error) {
          console.error('Error al guardar relaciones carrera-materia:', relationsResult.error);
          return { 
            data: { 
              career: career, 
              subjectsInserted: validSubjects.length, 
              relationsInserted: 0 
            }, 
            error: relationsResult.error 
          } as SupabaseResult;
        }

        console.log(`Relaciones carrera-materia guardadas correctamente:`, 
          relationsResult.data ? 
          `${relationsResult.data.insertedCount} de ${relationsResult.data.totalCount}` : 
          'Sin detalle de respuesta');

        // 5. Procesar correlativas solo si todo lo anterior fue exitoso
        if (errors.length === 0) {
          console.log('Procesando correlativas...');
          return this.processPrerequistesInBulk(career, validSubjects)
            .then((correlativesResponse: SaveCareerResponse | SupabaseResult) => {
              // Unificar formato de respuesta para processPrerequistesInBulk
              const correlativesResult = 'success' in correlativesResponse 
                ? { data: correlativesResponse, error: null } as SupabaseResult
                : correlativesResponse;

              return {
                data: {
                  career: career,
                  subjectsInserted: validSubjects.length,
                  relationsInserted: careerSubjectsData.length,
                  correlativesResult: correlativesResult.data
                },
                error: correlativesResult.error
              } as SupabaseResult;
            });
        }

        // Si hay errores, no procesamos correlativas
        return {
          data: {
            career: career,
            subjectsInserted: validSubjects.length,
            relationsInserted: careerSubjectsData.length,
            errors: errors
          },
          error: errors.length > 0 ? errors[0] : null
        } as SupabaseResult;
      });
  }
} 