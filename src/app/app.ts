import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AlertModal } from './components/alert-modal/alert-modal';
import { DistributionPanel } from './components/distribution-panel/distribution-panel';
import { MealSection } from './components/meal-section/meal-section';
import { ProfilesPanel } from './components/profiles-panel/profiles-panel';
import { Toast } from './components/toast/toast';
import { TotalSection } from './components/total-section/total-section';
import { VdrPanel } from './components/vdr-panel/vdr-panel';
import { COMIDAS } from './data/nutrients.data';
import { EmojiRain } from './services/emoji-rain';
import { NutritionStore } from './services/nutrition-store';
import { UiOverlay } from './services/ui-overlay';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [
    VdrPanel,
    ProfilesPanel,
    DistributionPanel,
    MealSection,
    TotalSection,
    AlertModal,
    Toast,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly store = inject(NutritionStore);
  readonly ui = inject(UiOverlay);
  private readonly rain = inject(EmojiRain);

  readonly comidas = COMIDAS;

  abrirPerfiles(): void {
    this.ui.openPanel('panel1');
    this.rain.detenerLluvia();
  }

  abrirVDR(): void {
    this.ui.openPanel('panel');
    this.rain.detenerLluvia();
  }

  cerrarPanel3(): void {
    this.ui.openPanel('panel1');
  }
}
