export interface SceneContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

export interface Scene<S = unknown> {
  name: string;
  description: string;
  init(ctx: SceneContext): S;
  frame(state: S, ctx: SceneContext, dtMs: number): void;
}
