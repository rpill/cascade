/** Source crop for an undistorted image covering a destination rectangle. */
export function coverCrop(sourceWidth: number, sourceHeight: number, width: number, height: number, focusX = 0.5, focusY = 0.5) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  return { x: (sourceWidth - cropWidth) * Math.max(0, Math.min(1, focusX)), y: (sourceHeight - cropHeight) * Math.max(0, Math.min(1, focusY)), width: cropWidth, height: cropHeight };
}
