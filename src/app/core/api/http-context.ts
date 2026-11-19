import { HttpContextToken } from '@angular/common/http';

/** Peticiones cuyo 401 no debe mandar al login con aviso de "sesión vencida". */
export const SKIP_SESSION_REDIRECT = new HttpContextToken<boolean>(() => false);
