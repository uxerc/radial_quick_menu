/** Fullscreen frozen frame; drag a rectangle, Esc cancels. Resolves with the cropped canvas. */
export function selectArea(source: HTMLCanvasElement): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'area-select';
    overlay.dataset.testid = 'area-select';
    const img = document.createElement('canvas');
    img.width = source.width;
    img.height = source.height;
    img.getContext('2d')!.drawImage(source, 0, 0);
    const box = document.createElement('div');
    box.className = 'area-box';
    overlay.append(img, box);
    document.body.append(overlay);

    let start: { x: number; y: number } | null = null;
    const rect = { x: 0, y: 0, w: 0, h: 0 };

    const finish = (result: HTMLCanvasElement | null) => {
      overlay.remove();
      window.removeEventListener('keydown', onKey, true);
      resolve(result);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish(null);
      }
    };
    window.addEventListener('keydown', onKey, true);

    overlay.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      start = { x: e.clientX, y: e.clientY };
      overlay.setPointerCapture(e.pointerId);
    });
    overlay.addEventListener('pointermove', (e) => {
      if (!start) return;
      rect.x = Math.min(start.x, e.clientX);
      rect.y = Math.min(start.y, e.clientY);
      rect.w = Math.abs(e.clientX - start.x);
      rect.h = Math.abs(e.clientY - start.y);
      Object.assign(box.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px`, display: 'block' });
    });
    overlay.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      if (!start || rect.w < 4 || rect.h < 4) return finish(null);
      const bounds = img.getBoundingClientRect();
      const scale = source.width / bounds.width;
      const crop = document.createElement('canvas');
      crop.width = Math.round(rect.w * scale);
      crop.height = Math.round(rect.h * scale);
      crop.getContext('2d')!.drawImage(
        source,
        (rect.x - bounds.left) * scale, (rect.y - bounds.top) * scale, crop.width, crop.height,
        0, 0, crop.width, crop.height,
      );
      finish(crop);
    });
  });
}
