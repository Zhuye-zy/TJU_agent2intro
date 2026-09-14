import type { SceneAction, SceneAdapter } from '../../../shared/contracts';

export interface CampusSceneHooks {
  focusBuilding(buildingId: string): boolean;
  showBuildingCard(buildingId: string): boolean;
}

export class CampusCardSceneAdapter implements SceneAdapter {
  readonly kind = '2d' as const;
  constructor(private readonly hooks: CampusSceneHooks) {}
  async execute(action: SceneAction): Promise<{ status: 'completed' | 'failed'; error_code?: 'execution_failed' | 'unsupported' }> {
    const buildingId = action.parameters.building_id;
    const completed = action.type === 'focus_building'
      ? this.hooks.focusBuilding(buildingId)
      : this.hooks.showBuildingCard(buildingId);
    return completed ? { status: 'completed' } : { status: 'failed', error_code: 'execution_failed' };
  }
}
