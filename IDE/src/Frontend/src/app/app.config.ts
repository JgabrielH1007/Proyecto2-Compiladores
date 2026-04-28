import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http'; // Esto es vital para tu backend
import { routes } from './app.routes'; 

// 👇 Esta es la parte exacta que Angular te está pidiendo que exportes
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient() // Con esto tu ApiService funcionará perfecto
  ]
};