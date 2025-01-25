import { describe, it, expect, beforeAll, vi } from 'vitest';
import worker from '../index';

describe('Career Loader Worker', () => {
  beforeAll(() => {
    // Mock fetch
    global.fetch = vi.fn();
  });

  it('should handle OPTIONS request with CORS headers', async () => {
    const request = new Request('http://localhost', {
      method: 'OPTIONS'
    });

    const response = await worker.fetch(request, {}, {
      waitUntil: () => {},
      passThroughOnException: () => {}
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
  });

  it('should reject non-GET requests', async () => {
    const request = new Request('http://localhost', {
      method: 'POST'
    });

    const response = await worker.fetch(request, {}, {
      waitUntil: () => {},
      passThroughOnException: () => {}
    });

    expect(response.status).toBe(405);
    const data = await response.json();
    expect(data.error).toBe('Method not allowed');
  });

  it('should require URL parameter', async () => {
    const request = new Request('http://localhost');

    const response = await worker.fetch(request, {}, {
      waitUntil: () => {},
      passThroughOnException: () => {}
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('URL parameter is required');
  });

  it('should process HTML and return career data', async () => {
    const html = `
      <div id="ctl00_ContentPlaceHolderMain_lbl_TituloCarrera">
        Ingeniería en Sistemas
      </div>
      <table class="tabla-contenido">
        <tr><th>Plan: 2008 (2008)</th></tr>
        <tr><th>1º AÑO</th></tr>
        <tr>
          <td>95.01</td>
          <td>Algoritmos y Programación I</td>
          <td>
            <span class="correlativa-fuerte">CBC</span>
          </td>
        </tr>
      </table>
    `;

    // Mock fetch response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(html)
    });

    const targetUrl = 'https://example.com/career?id_carrera=9&id_facultad=86';
    const request = new Request(`http://localhost?url=${encodeURIComponent(targetUrl)}`);

    const response = await worker.fetch(request, {}, {
      waitUntil: () => {},
      passThroughOnException: () => {}
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({
      id: '9',
      name: 'Ingeniería en Sistemas',
      faculty: {
        id: '86',
        name: 'Facultad de Ingeniería'
      }
    });
  });

  it('should handle fetch errors', async () => {
    // Mock fetch error
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const request = new Request('http://localhost?url=https://example.com/error');

    const response = await worker.fetch(request, {}, {
      waitUntil: () => {},
      passThroughOnException: () => {}
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Network error');
  });
}); 