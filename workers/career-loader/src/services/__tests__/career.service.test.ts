import { describe, it, expect } from 'vitest';
import { CareerService } from '../career.service';

describe('CareerService', () => {
  describe('processHtml', () => {
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

      const url = 'https://example.com/career?id_carrera=9&id_facultad=86';
      const career = await CareerService.processHtml(html, url);

      expect(career).toMatchObject({
        id: '9',
        name: 'Ingeniería en Sistemas',
        faculty: {
          id: '86',
          name: 'Facultad de Ingeniería'
        },
        plan: {
          id: '2008',
          year: '2008'
        },
        subjects: [
          {
            id: '95.01',
            code: '95.01',
            name: 'Algoritmos y Programación I',
            year: 1,
            semester: 1,
            isOptional: false,
            correlatives: {
              weak: [],
              strong: [{ code: 'CBC' }]
            }
          }
        ],
        totalYears: 1
      });
    });

    it('should handle missing data gracefully', async () => {
      const html = '<div>Empty page</div>';
      const url = 'https://example.com/career';
      const career = await CareerService.processHtml(html, url);

      expect(career).toMatchObject({
        id: '',
        name: '',
        faculty: {
          id: '',
          name: 'Facultad de Ingeniería'
        },
        plan: {
          id: '',
          year: ''
        },
        subjects: [],
        totalYears: 0
      });
    });
  });
}); 