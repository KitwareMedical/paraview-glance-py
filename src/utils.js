import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import vtkPoints from 'vtk.js/Sources/Common/Core/Points';
import vtkPolyData from 'vtk.js/Sources/Common/DataModel/PolyData';
import vtkTubeFilter from 'vtk.js/Sources/Filters/General/TubeFilter';
import { VaryRadius } from 'vtk.js/Sources/Filters/General/TubeFilter/Constants';
import { VtkDataTypes } from 'vtk.js/Sources/Common/Core/DataArray/Constants';

export function makeSubManager() {
  let currentSub = null;

  const api = {
    sub(subscription) {
      api.unsub();
      currentSub = subscription;
    },
    unsub() {
      if (currentSub !== null) {
        currentSub.unsubscribe();
        currentSub = null;
      }
    },
  };

  return api;
}

export function wrapSub(sub) {
  const subManager = makeSubManager();
  return subManager.sub(sub);
}

export function forAllViews(pxm, callback) {
  pxm.getViews().forEach((view) => callback(view));
  return pxm.onProxyRegistrationChange((info) => {
    if (info.proxyGroup === 'Views' && info.action === 'register') {
      callback(info.proxy);
    }
  });
}

/**
 * Wrap a mutation as a vuex action.
 */
export function wrapMutationAsAction(mutation) {
  return ({ commit }, value) => commit(mutation, value);
}

/**
 * Converts a centerline to a tube poly data
 */
export function centerlineToTube(centerline) {
  const pd = vtkPolyData.newInstance();
  const pts = vtkPoints.newInstance({
    dataType: VtkDataTypes.FLOAT,
    numberOfComponents: 3,
  });
  pts.setNumberOfPoints(centerline.length);

  const pointData = new Float32Array(3 * centerline.length);
  const lines = new Uint32Array(centerline.length + 1);

  lines[0] = centerline.length;
  for (let i = 0; i < centerline.length; ++i) {
    pointData[3 * i + 0] = centerline[i].point[0];
    pointData[3 * i + 1] = centerline[i].point[1];
    pointData[3 * i + 2] = centerline[i].point[2];
    lines[i + 1] = i;
  }

  const radii = centerline.map((p) => p.radius);
  const radiusData = new Float32Array(radii);
  const radius = vtkDataArray.newInstance({
    name: 'Radius',
    values: radiusData,
  });

  pts.setData(pointData);
  pd.setPoints(pts);
  pd.getLines().setData(lines);
  pd.getPointData().addArray(radius);

  const filter = vtkTubeFilter.newInstance({
    capping: true,
    radius: 1, // scaling factor
    varyRadius: VaryRadius.VARY_RADIUS_BY_ABSOLUTE_SCALAR,
    numberOfSides: 20,
  });

  filter.setInputArrayToProcess(0, 'Radius', 'PointData', 'Scalars');
  filter.setInputData(pd);

  return filter.getOutputData();
}

/**
 * Converts a polydata consisting of triangle strips into polys.
 */
export function convertStripsToPolys(pd) {
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

export default {
  makeSubManager,
  wrapSub,
  forAllViews,
  wrapMutationAsAction,
  centerlineToTube,
  convertStripsToPolys,
};
