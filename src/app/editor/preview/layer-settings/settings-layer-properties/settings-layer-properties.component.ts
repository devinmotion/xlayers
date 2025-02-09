import { UiState } from '@app/core/state';
import { Store } from '@ngxs/store';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'xly-settings-layer-properties',
  template: `
  <mat-expansion-panel expanded="false" [disabled]="!currentLayer?.name">
  <mat-expansion-panel-header>
    <mat-panel-title>
      {{'SETTINGS_PROPERTIES.properties' | translate}}
    </mat-panel-title>
  </mat-expansion-panel-header>

  <mat-form-field class="large">
    <input disabled matInput type="text" placeholder="{{'SETTINGS_PROPERTIES.name' | translate }}" [ngModel]="currentLayer?.name">
  </mat-form-field>
  <mat-form-field class="large">
    <input disabled matInput type="text" placeholder="{{'SETTINGS_PROPERTIES.kind' | translate }}" [ngModel]="currentLayer?._class">
  </mat-form-field>

  </mat-expansion-panel>

  `,
  styles: [`
  :host {
    text-align: center;
  }
  mat-form-field {
    padding: 14px;
  }
  `]
})
export class SettingsLayerPropertiesComponent implements OnInit {

  currentLayer: SketchMSLayer;

  constructor(private store: Store) { }

  ngOnInit() {
    this.store.select(UiState.currentLayer).subscribe(currentLayer => {
      this.currentLayer = currentLayer;
    });
  }

}
