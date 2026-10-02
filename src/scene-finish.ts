import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

export class SceneFinish {
  private readonly composer: EffectComposer;
  private readonly antialias = new ShaderPass(FXAAShader);
  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.composer = new EffectComposer(renderer, target);
    this.composer.setPixelRatio(1);
    this.composer.addPass(new RenderPass(scene, camera));
    // Only emissive bulbs and devices bloom. Labels are drawn afterwards.
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.07, 0.25, 1.6));
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.antialias);
  }
  resize(width: number, height: number) {
    this.composer.setSize(width, height);
    this.antialias.uniforms.resolution.value.set(1 / width, 1 / height);
  }
  draw(scene: THREE.Scene, camera: THREE.Camera, detail: boolean, width: number) {
    // Small screens and the existing simple mode avoid post-processing targets.
    if (detail && width >= 600) this.composer.render(0);
    else this.renderer.render(scene, camera);
  }
}

/** Reusable, deterministic surface relief; generated locally, no downloads. */
export class SurfaceRelief {
  readonly plaster = this.texture('plaster');
  readonly wood = this.texture('wood');
  readonly stone = this.texture('stone');
  readonly metal = this.texture('metal');
  readonly patina = this.texture('patina');
  private texture(kind: 'plaster' | 'wood' | 'stone' | 'metal' | 'patina') {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d')!, pixels = context.createImageData(256, 256);
    let seed = 1879;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const grain = kind === 'wood' ? Math.sin(y * 1.1 + Math.sin(x * 0.027) * 2) * 12
        : kind === 'metal' ? Math.sin(y * 2.7) * 9
        : Math.sin(x * .071) * Math.sin(y * .047) * 8;
      const value = (kind === 'patina' ? 218 : 144) + grain + (random() - 0.5) * (kind === 'metal' ? 10 : kind === 'stone' ? 30 : 24), i = (y * 256 + x) * 4;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value; pixels.data[i + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
    texture.repeat.set(kind === 'plaster' || kind === 'patina' ? 2 : 8, kind === 'plaster' || kind === 'patina' ? 2 : 5);
    return texture;
  }
}
