import { Component, input } from '@angular/core';

/** Título de página; las acciones se proyectan con `<div actions>`. */
@Component({
  selector: 'app-page-header',
  templateUrl: './page-header.html',
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
