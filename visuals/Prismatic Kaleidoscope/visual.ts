import { defineVisual } from '@lux/visual-sdk';
import { createSpikyBall } from './spiky-ball.ts';
import { createKaleidoscope } from './kaleidoscope.ts';

export default defineVisual({
  controls: {
    blend: { type: 'number', label: 'Kaleidoscope blend', default: 1, min: 0, max: 1, step: 0.01 },
    segments: { type: 'number', label: 'Mirror segments', default: 6, min: 2, max: 16, step: 1 },
    zoom: { type: 'number', label: 'Pattern zoom', default: 1.25, min: 0.4, max: 3, step: 0.01 },
    rings: { type: 'number', label: 'Radial repeats', default: 1.2, min: 0.4, max: 4, step: 0.01 },
    rotation: { type: 'number', label: 'Pattern angle', default: 0, min: -3.1416, max: 3.1416, step: 0.01, unit: 'rad' },
    spin: { type: 'number', label: 'Pattern spin', default: 0.08, min: -0.6, max: 0.6, step: 0.01, unit: 'rad/s' },
    twist: { type: 'number', label: 'Spiral twist', default: 0.35, min: -4, max: 4, step: 0.01 },
    prism: { type: 'number', label: 'Prism fringe', default: 0.001, min: 0, max: 0.025, step: 0.001 },
    sourceRadius: { type: 'number', label: 'Source sampling radius', default: 0.19, min: 0.05, max: 0.35, step: 0.005 },
    offsetX: { type: 'number', label: 'Source offset X', default: 0.015, min: -0.12, max: 0.12, step: 0.005 },
    offsetY: { type: 'number', label: 'Source offset Y', default: 0.015, min: -0.12, max: 0.12, step: 0.005 },
    drift: { type: 'number', label: 'Source drift', default: 0.05, min: -0.5, max: 0.5, step: 0.01 },
    intensity: { type: 'number', label: 'Ball spike amount', default: 0.67, min: 0, max: 1, step: 0.01 },
  },
  async create(context) {
    const ball = await createSpikyBall(context);
    const kaleidoscope = createKaleidoscope(ball.scene, ball.camera, context.settings.width / context.settings.height);
    return {
      update(frame) {
        ball.update(frame.timeSeconds, frame.controls.intensity);
        kaleidoscope.update(frame.timeSeconds, frame.controls);
      },
      render(target) { return context.renderer.render(kaleidoscope.scene, kaleidoscope.camera, target); },
      reset(seed) { ball.reset(seed); },
      dispose() { kaleidoscope.dispose(); ball.dispose(); },
    };
  },
});
