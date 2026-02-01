import * as THREE from 'three';

import { RenderObject } from './render_object';

import './styles.css';

export class Label3D extends RenderObject {
  parent;
  element;
  position: THREE.Vector3;
  checkOcclusion: boolean;
  raycaster: THREE.Raycaster;

  constructor(parent, data, path = []) {
    super(data, {}, path);
    this.render_modes = ['overlay'];

    const element = document.createElement('div');
    const el_text = document.createTextNode(this.data.text);
    element.appendChild(el_text);

    parent.appendChild(element);

    element.classList.add('label3d');
    element.style.top = '0px';
    element.style.left = '0px';

    // Enable occlusion detection by default
    // Disable only when explicitly set to false (e.g., for UI elements like axes)
    this.checkOcclusion = (this.data as any).checkOcclusion !== undefined
      ? Boolean((this.data as any).checkOcclusion)
      : true;

    // Create raycaster once for reuse
    this.raycaster = new THREE.Raycaster();

    this.parent = parent;
    this.element = element;
    if (this.data.position instanceof THREE.Vector3)
      this.position = new THREE.Vector3().copy(this.data.position);
    else this.position = new THREE.Vector3().fromArray(this.data.position);
  }

  render(data) {
    if (!this.update(data)) {
      this.element.style.visibility = 'hidden';
      return;
    }
    const { controls, camera, pivot, canvas, renderer, render_objects, scene } = data;
    const rect = canvas.getBoundingClientRect();
    this.element.style.visibility = 'visible';
    const vector = new THREE.Vector3();
    const mat = pivot !== undefined ? pivot.matrixWorld : controls.mat;
    vector.copy(this.position).applyMatrix4(mat);

    const projectedVector = vector.clone().project(camera);
    // map to 2D screen space
    const x = Math.round(((projectedVector.x + 1) * rect.width) / 2);
    const y = Math.round(((-projectedVector.y + 1) * rect.height) / 2);
    this.element.style.top = `${y}px`;
    this.element.style.left = `${x}px`;

    // Check if outside viewport
    const margin = 10;
    if (
      x < margin ||
      y < margin ||
      y > rect.height - margin ||
      x > rect.width - margin
    ) {
      this.element.style.display = 'none';
      return;
    }

    // Occlusion detection using raycasting
    if (this.checkOcclusion && render_objects) {
      // Raycast in world space:
      // - Viewer is always at camera.position (0,0,3) in world space
      // - vector is the label position transformed to world space (via mat)
      // - mesh objects have matrixWorld set to mat, so vertices are in world space
      const direction = new THREE.Vector3();
      direction.subVectors(vector, camera.position).normalize();
      this.raycaster.set(camera.position, direction);

      // Collect all THREE.js mesh objects from render_objects
      // render_objects contains the webgui render objects, each with a three_object property
      const meshObjects: any[] = [];
      for (const renderObj of render_objects) {
        if (renderObj.three_object && renderObj.three_object.type === 'Mesh') {
          // Don't call updateMatrixWorld() - it would overwrite the correct matrixWorld
          // that was set in mesh.render() with controls.mat
          meshObjects.push(renderObj.three_object);
        }
      }

      // Intersect with mesh objects
      const intersects = this.raycaster.intersectObjects(meshObjects, false);

      if (intersects.length > 0) {
        const viewerToLabel = vector.distanceTo(camera.position);
        const viewerToGeometry = intersects[0].distance;

        // Add small tolerance for labels on surface
        const tolerance = 0.01;
        if (viewerToGeometry < viewerToLabel - tolerance) {
          // Geometry is in front of label - hide it
          this.element.style.display = 'none';
          return;
        }
      }
    }

    // Label is visible
    this.element.style.display = 'block';
  }
}
