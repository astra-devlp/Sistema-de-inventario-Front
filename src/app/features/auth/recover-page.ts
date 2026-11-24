import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { httpErrorMessage } from '@core/api/api-error';
import { AuthService } from '@core/auth/auth.service';
import { normalizeCode, resetPasswordError } from '@core/auth/password-rules';

type Step = 'email' | 'code' | 'password' | 'done';

/**
 * Recuperar la contraseña: correo → código de 6 dígitos → contraseña nueva. La API responde lo mismo exista o no el
 * correo, así que el paso del código siempre se muestra. El código y las contraseñas viven solo en esta pantalla.
 */
@Component({
  selector: 'app-recover-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './recover-page.html',
})
export class RecoverPage {
  private readonly auth = inject(AuthService);

  protected readonly step = signal<Step>('email');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly info = signal<string | null>(null);
  protected readonly email = signal('');
  protected readonly code = signal('');
  protected readonly next = signal('');
  protected readonly confirm = signal('');

  protected sendCode(): void {
    const email = this.email().trim();
    if (!email.includes('@')) {
      this.error.set('Escribe el correo con el que inicias sesión');
      return;
    }
    this.run(this.auth.forgotPassword(email), (answer) => {
      this.info.set(`${answer.detail} Revisa también la carpeta de spam. El código vence en 10 minutos.`);
      this.step.set('code');
    }, 'No se pudo enviar el código');
  }

  protected checkCode(): void {
    const code = normalizeCode(this.code());
    if (!code) {
      this.error.set('El código son 6 dígitos');
      return;
    }
    this.run(this.auth.verifyResetCode(this.email().trim(), code), () => {
      this.code.set(code);
      this.info.set(null);
      this.step.set('password');
    }, 'No se pudo comprobar el código');
  }

  protected savePassword(): void {
    const problem = resetPasswordError(this.next(), this.confirm());
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.run(this.auth.resetPassword(this.email().trim(), this.code(), this.next()), () => {
      this.code.set('');
      this.next.set('');
      this.confirm.set('');
      this.step.set('done');
    }, 'No se pudo cambiar la contraseña');
  }

  protected restart(): void {
    this.code.set('');
    this.error.set(null);
    this.info.set(null);
    this.step.set('email');
  }

  private run<T>(request: Observable<T>, done: (value: T) => void, fallback: string): void {
    this.error.set(null);
    this.busy.set(true);
    request.subscribe({
      next: (value) => {
        this.busy.set(false);
        done(value);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        // 400: código inválido o vencido. Con el código ya usado o quemado, volver a pedir uno.
        if (err instanceof HttpErrorResponse && err.status === 400 && this.step() === 'password') this.step.set('code');
        this.error.set(httpErrorMessage(err, fallback));
      },
    });
  }
}
