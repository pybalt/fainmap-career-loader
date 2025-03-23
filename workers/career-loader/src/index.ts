import { Env, ExecutionContext } from './types';
import { CareerService } from './services/career.service';
import { DatabaseService } from './services/database.service';

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    try {
      // Configure CORS
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }

      // Only accept POST requests
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }

      // Obtener HTML del body
      const html = await request.text();
      
      if (!html) {
        return new Response(JSON.stringify({ error: 'HTML content is required' }), { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }

      // Obtener parámetros adicionales de la URL
      const url = new URL(request.url);
      const facultyId = url.searchParams.get('facultyId') || '';
      const facultyName = url.searchParams.get('facultyName') || '';
      const saveToDb = url.searchParams.get('saveToDb') === 'true';
      
      console.log('Parámetros de URL recibidos:', {
        facultyId,
        facultyName,
        saveToDb,
        url: request.url
      });

      // 1. Procesar el HTML básico sin validación
      let career = await CareerService.processHtmlBasic(html, request.url);

      // 2. Actualizar información de facultad si se proporcionó como parámetro
      if (facultyId) {
        console.log('Actualizando facultyId desde parámetro:', facultyId);
        career.faculty.id = facultyId;
      }
      
      if (facultyName) {
        console.log('Actualizando facultyName desde parámetro:', facultyName);
        career.faculty.name = facultyName;
      }
      
      // 3. Validar la carrera después de actualizar los datos
      console.log('Validando carrera para determinar si es segura...');
      CareerService.validateAndMarkCareer(career);
      console.log('Resultado de validación - safe:', career.safe);

      // Respuesta que incluirá información sobre la operación de guardado
      const response: any = { 
        career,
        dbOperation: null
      };

      // Guardar en la base de datos si se solicita
      if (saveToDb) {
        console.log('Se solicitó guardar en base de datos (saveToDb=true)');
        const dbService = DatabaseService.fromEnv(env);
        if (dbService) {
          console.log('Servicio de base de datos inicializado correctamente');
          // Si el objeto no es seguro, la función saveCareer internamente no realizará el guardado
          console.log('Iniciando operación de guardado en base de datos...');
          const dbResult = await dbService.saveCareer(career);
          console.log('Resultado de operación de guardado:', dbResult);
          response.dbOperation = dbResult;
        } else {
          console.error('No se pudo inicializar el servicio de base de datos');
          response.dbOperation = {
            success: false,
            message: 'No se pudieron obtener las credenciales de Supabase',
            stats: { timestamp: new Date().toISOString() }
          };
        }
      } else {
        console.log('No se solicitó guardar en base de datos (saveToDb=false)');
      }

      // Return JSON response
      return new Response(JSON.stringify(response), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      console.error('Error processing request:', error);
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
}; 