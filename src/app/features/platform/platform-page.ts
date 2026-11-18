import { Component } from '@angular/core';
import { PageHeader } from '@shared/ui/page-header/page-header';

/** El administrador de plataforma opera empresas, planes, unidades e IVA; esas pantallas llegan en una etapa posterior. */
@Component({
  selector: 'app-platform-page',
  imports: [PageHeader],
  templateUrl: './platform-page.html',
})
export class PlatformPage {}
