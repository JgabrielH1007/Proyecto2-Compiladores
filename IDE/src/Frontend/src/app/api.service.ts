import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // La URL de tu servidor Node.js (Asegúrate de que el puerto sea el correcto, usualmente 3000)
  private apiUrl = 'http://localhost:3000/api'; 

  constructor(private http: HttpClient) {}

  // Esta es la función que TypeScript te está pidiendo
  enviarCodigo(codigo: string, tipo: string): Observable<any> {
    const payload = {
      codigo: codigo,
      tipo: tipo
    };
    return this.http.post(`${this.apiUrl}/analizar`, payload);
  }
}