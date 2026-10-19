import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import { AuthUser, UserRole } from '@core/auth/auth.model';

export interface UserPayload {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  phone: string | null;
  is_active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);

  list(query = ''): Observable<AuthUser[]> {
    const params = query.trim() ? new HttpParams().set('name', query.trim()) : undefined;
    const path = query.trim() ? '/users/search' : '/users';
    return this.http.get<AuthUser[]>(`${API_URL}${path}`, { params });
  }

  create(payload: UserPayload): Observable<AuthUser> {
    return this.http.post<AuthUser>(`${API_URL}/users`, payload);
  }

  update(id: number, payload: Partial<UserPayload>): Observable<AuthUser> {
    return this.http.patch<AuthUser>(`${API_URL}/users/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/users/${id}`);
  }
}
