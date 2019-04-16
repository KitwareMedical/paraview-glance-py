export default function convertStripsToPolys(pd) {
  const strips = pd.getStrips().getData();

  // compute number of triangles
  let numTriangles = 0;
  for (let i = 0; i < strips.length; i++) {
    const stripLen = strips[i];
    numTriangles += stripLen - 2;
    i += stripLen;
  }

  const polys = new strips.constructor(numTriangles * 4);
  let pindex = 0;
  for (let i = 0; i < strips.length; i++) {
    let stripLen = strips[i];
    let flip = false;
    while (stripLen > 2) {
      i++;
      stripLen--;
      polys[pindex++] = 3;
      if (flip) {
        polys[pindex++] = strips[i + 1];
        polys[pindex++] = strips[i];
        polys[pindex++] = strips[i + 2];
      } else {
        polys[pindex++] = strips[i];
        polys[pindex++] = strips[i + 1];
        polys[pindex++] = strips[i + 2];
      }
      flip = !flip;
    }
    i += 2;
  }

  pd.getPolys().setData(polys);
  // clear strips
  pd.getStrips().setData(new strips.constructor());

  return pd;
}
