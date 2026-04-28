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

  enviarCodigo(codigo: string, tipo: string) {
    // Asegúrate de que apunte al localhost:3000 y a la ruta exacta
    const url = 'http://localhost:3000/api/enviarCodigo'; 
    const body = { codigo: codigo, formato: tipo };
    
    return this.http.post(url, body);
  }
}