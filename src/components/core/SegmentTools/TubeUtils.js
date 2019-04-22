import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import vtkPoints from 'vtk.js/Sources/Common/Core/Points';
import vtkPolyData from 'vtk.js/Sources/Common/DataModel/PolyData';
import vtkTubeFilter from 'vtk.js/Sources/Filters/General/TubeFilter';
import { VaryRadius } from 'vtk.js/Sources/Filters/General/TubeFilter/Constants';
import { VtkDataTypes } from 'vtk.js/Sources/Common/Core/DataArray/Constants';

export function getTubeIdFromCell(cellId, cellToTube) {
  for (let i = 0; i < cellToTube.length; i++) {
    const [cellIdThreshold, tubeId] = cellToTube[i];
    if (cellId < cellIdThreshold) {
      return tubeId;
    }
  }
  return -1;
}

export function makeTubeCollection() {
  const order = [];
  const map = {};

  return {
    getList() {
      return order;
    },
    get(id) {
      const index = map[id];
      if (index !== undefined) {
        return order[index];
      }
      return null;
    },
    put(id, obj) {
      const index = map[id];
      if (index === undefined) {
        map[id] = order.length;
        order.push(obj);
      } else {
        order[index] = obj;
      }
    },
    delete(id) {
      const index = map[id];
      if (index !== undefined) {
        // rewrite map
        for (let i = index + 1; i < order.length; i++) {
          map[order[i].id]--;
        }
        order.splice(index, 1);
        delete map[id];
      }
    },
  };
}

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
  const scalarsData = new Float32Array(radii);
  const scalars = vtkDataArray.newInstance({
    name: 'Radius',
    values: scalarsData,
  });

  pts.setData(pointData);
  pd.setPoints(pts);
  pd.getLines().setData(lines);
  pd.getPointData().setScalars(scalars);

  const filter = vtkTubeFilter.newInstance({
    capping: true,
    radius: 1, // scaling factor
    varyRadius: VaryRadius.VARY_RADIUS_BY_ABSOLUTE_SCALAR,
    numberOfSides: 50,
  });

  filter.setInputArrayToProcess(0, 'Radius', 'PointData', 'Scalars');
  filter.setInputData(pd);

  return filter.getOutputData();
}

export default {
  getTubeIdFromCell,
  makeTubeCollection,
  centerlineToTube,
};
