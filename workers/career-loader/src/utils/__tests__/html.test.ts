import { describe, it, expect } from 'vitest';
import { extractCareerName, extractPlanInfo, extractSubjects } from '../html';

describe('HTML Utils', () => {
  describe('extractCareerName', () => {
    it('should extract career name from title element', () => {
      const html = `
        <div id="ctl00_ContentPlaceHolderMain_lbl_TituloCarrera">
          Ingeniería en Sistemas
        </div>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      expect(extractCareerName(doc)).toBe('Ingeniería en Sistemas');
    });

    it('should return empty string if title element not found', () => {
      const html = '<div>No title here</div>';
      const doc = new DOMParser().parseFromString(html, 'text/html');
      expect(extractCareerName(doc)).toBe('');
    });
  });

  describe('extractPlanInfo', () => {
    it('should extract plan id and year', () => {
      const html = `
        <table class="tabla-contenido">
          <tr><th>Plan: 2008 (2008)</th></tr>
        </table>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const planInfo = extractPlanInfo(doc);
      expect(planInfo).toEqual({
        id: '2008',
        year: '2008'
      });
    });

    it('should return empty strings if plan info not found', () => {
      const html = '<div>No plan info</div>';
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const planInfo = extractPlanInfo(doc);
      expect(planInfo).toEqual({
        id: '',
        year: ''
      });
    });
  });

  describe('extractSubjects', () => {
    it('should extract subjects from table', () => {
      const html = `
        <table class="tabla-contenido">
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
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const subjects = extractSubjects(doc);
      
      expect(subjects).toHaveLength(1);
      expect(subjects[0]).toMatchObject({
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
      });
    });

    it('should handle optional subjects', () => {
      const html = `
        <table class="tabla-contenido">
          <tr><th>5º AÑO</th></tr>
          <tr>
            <td>95.99</td>
            <td>Materia Optativa</td>
            <td></td>
          </tr>
        </table>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const subjects = extractSubjects(doc);
      
      expect(subjects).toHaveLength(1);
      expect(subjects[0].isOptional).toBe(true);
    });
  });
}); 