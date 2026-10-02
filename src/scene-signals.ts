/** A shared engraved symbol links a pressure plate to its gate without a label.
 * Colour is secondary: the outline and notch count carry the same identity. */
export function signalGlyph(c: CanvasRenderingContext2D, identity: number, x: number, y: number, radius: number, color: string) {
  const sides = 3 + identity % 6, notches = 1 + Math.floor(identity / 6);
  c.save(); c.translate(x, y); c.strokeStyle = color; c.lineWidth = 1.8; c.lineJoin = 'round';
  c.beginPath();
  for (let i = 0; i <= sides; i++) {
    const angle = i / sides * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(angle) * radius, py = Math.sin(angle) * radius;
    if (i) c.lineTo(px, py); else c.moveTo(px, py);
  }
  c.stroke();
  for (let i = 0; i < notches; i++) {
    const dx = (i - (notches - 1) / 2) * 4;
    c.beginPath(); c.moveTo(dx, -2.5); c.lineTo(dx, 2.5); c.stroke();
  }
  c.restore();
}
