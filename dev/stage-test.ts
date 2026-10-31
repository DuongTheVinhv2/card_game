import * as THREE from 'three';
import { createStage } from '../src/gfx/stage';
const stage = createStage({ parent: document.getElementById('app')! });
const m = new THREE.Mesh(new THREE.TorusKnotGeometry(3, 0.8, 200, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 0.3) }));
stage.scene.add(m);
const clock = new THREE.Clock();
function loop() { const dt = clock.getDelta(); m.rotation.y += dt; stage.render(dt); requestAnimationFrame(loop); }
loop();
(window as any).__info = () => ({ gl: stage.renderer.getContext().getParameter(stage.renderer.getContext().VERSION), renderer: (() => { const gl = stage.renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a'; })() });
