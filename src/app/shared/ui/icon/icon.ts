import { Component, computed, input } from '@angular/core';
import {
  LucideBarcode,
  LucideBox,
  LucideCheck,
  LucideChevronDown,
  LucideChevronLeft,
  LucideChevronRight,
  LucideDollarSign,
  LucideDownload,
  LucideDynamicIcon,
  LucideEye,
  LucideFunnel,
  LucideHouse,
  LucideLayers,
  LucideLogOut,
  LucideMenu,
  LucidePanelLeft,
  LucidePercent,
  LucidePlus,
  LucidePrinter,
  LucideRuler,
  LucideSearch,
  LucideShoppingCart,
  LucideSquarePen,
  LucideTag,
  LucideTrash2,
  LucideTriangleAlert,
  LucideTruck,
  LucideUpload,
  LucideUsers,
  LucideX,
} from '@lucide/angular';

/**
 * Nombres internos de la app -> íconos de Lucide (https://lucide.dev, licencia ISC).
 * Para usar un ícono nuevo: impórtalo arriba y agrégalo aquí.
 */
const ICONS = {
  box: LucideBox,
  tag: LucideTag,
  barcode: LucideBarcode,
  layers: LucideLayers,
  ruler: LucideRuler,
  dollar: LucideDollarSign,
  percent: LucidePercent,
  plus: LucidePlus,
  search: LucideSearch,
  edit: LucideSquarePen,
  trash: LucideTrash2,
  eye: LucideEye,
  x: LucideX,
  download: LucideDownload,
  upload: LucideUpload,
  menu: LucideMenu,
  alert: LucideTriangleAlert,
  'chevron-left': LucideChevronLeft,
  'chevron-right': LucideChevronRight,
  'chevron-down': LucideChevronDown,
  'panel-left': LucidePanelLeft,
  printer: LucidePrinter,
  home: LucideHouse,
  cart: LucideShoppingCart,
  truck: LucideTruck,
  users: LucideUsers,
  logout: LucideLogOut,
  filter: LucideFunnel,
  check: LucideCheck,
} as const;

export type IconName = keyof typeof ICONS;

@Component({
  selector: 'app-icon',
  imports: [LucideDynamicIcon],
  templateUrl: './icon.html',
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(18);

  protected readonly icon = computed(() => ICONS[this.name()]);
}
