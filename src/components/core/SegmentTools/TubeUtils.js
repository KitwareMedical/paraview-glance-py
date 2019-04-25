/* eslint-disable import/no-named-as-default-member */
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import vtkPoints from 'vtk.js/Sources/Common/Core/Points';
import vtkPolyData from 'vtk.js/Sources/Common/DataModel/PolyData';
import vtkTubeFilter from 'vtk.js/Sources/Filters/General/TubeFilter';
import vtkAppendPolyData from 'vtk.js/Sources/Filters/General/AppendPolyData';
import { VaryRadius } from 'vtk.js/Sources/Filters/General/TubeFilter/Constants';
import { VtkDataTypes } from 'vtk.js/Sources/Common/Core/DataArray/Constants';

import vtkTubeGroup from 'paraview-glance/src/models/TubeGroup';

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
    numberOfSides: 50,
  });

  filter.setInputArrayToProcess(0, 'Radius', 'PointData', 'Scalars');
  filter.setInputData(pd);

  return filter.getOutputData();
}

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

export class TubeCollection {
  constructor() {
    this.order = [];
    this.map = {};
    this.tubeCache = {};
    this.cellToTubeId = []; // [ [# of cells before, tube id], ... ]
    this.tubeGroup = vtkTubeGroup.newInstance();
  }

  getAll() {
    return this.order;
  }

  getTubeGroup() {
    return this.tubeGroup;
  }

  get(id) {
    const index = this.map[id];
    if (index !== undefined) {
      return this.order[index];
    }
    return null;
  }

  put(centerline) {
    if (!('id' in centerline)) {
      throw new Error('Centerline has no id property');
    }

    const id = centerline.id;
    const index = this.map[id];
    if (index === undefined) {
      const c = Object.assign(
        {
          color: [1, 0, 0, 1], // default red color
        },
        centerline
      );

      this.map[id] = this.order.length;
      this.order.push(c);

      const tube = centerlineToTube(centerline.points);
      this.tubeCache[id] = convertStripsToPolys(tube);
      this.rebuild();
    }
  }

  delete(id) {
    const index = this.map[id];
    if (index !== undefined) {
      // rewrite map
      for (let i = index + 1; i < this.order.length; i++) {
        this.map[this.order[i].id]--;
      }
      this.order.splice(index, 1);
      delete this.map[id];

      this.rebuild();
    }
  }

  setColor(id, color4) {
    const index = this.map[id];
    if (index !== undefined) {
      this.order[index].color = color4.slice();
      this.rebuild();
    }
  }

  findTubeFromCell(cellId) {
    for (let i = 0; i < this.cellToTubeId.length; i++) {
      const [cellIdThreshold, tubeId] = this.cellToTubeId[i];
      if (cellId < cellIdThreshold) {
        return tubeId;
      }
    }
    return -1;
  }

  rebuild() {
    const filter = vtkAppendPolyData.newInstance();
    filter.setInputData(vtkPolyData.newInstance());

    let numberOfCells = 0;
    for (let i = 0; i < this.order.length; i++) {
      const tubePd = this.tubeCache[this.order[i].id];
      filter.addInputData(tubePd);
      numberOfCells += tubePd.getNumberOfCells();
    }

    this.tubeGroup = vtkTubeGroup.newInstance({
      internalPolyData: filter.getOutputData(),
    });

    // add colors
    const colorsData = new Uint8Array(4 * numberOfCells);
    let colorIndex = 0;
    for (let i = 0; i < this.order.length; i++) {
      const tubePd = this.tubeCache[this.order[i].id];
      const tubeColor = this.order[i].color;
      for (let j = 0; j < tubePd.getNumberOfCells(); j++) {
        colorsData[colorIndex++] = tubeColor[0] * 255;
        colorsData[colorIndex++] = tubeColor[1] * 255;
        colorsData[colorIndex++] = tubeColor[2] * 255;
        colorsData[colorIndex++] = tubeColor[3] * 255;
      }
    }

    const colors = vtkDataArray.newInstance({
      name: 'Colors',
      values: colorsData,
      numberOfComponents: 4,
    });

    this.tubeGroup.getCellData().addArray(colors);

    // rebuild cellToTubeId
    this.cellToTubeId = new Array(this.order.length);
    let cumulativeCellCount = 0;
    for (let i = 0; i < this.order.length; i++) {
      const id = this.order[i].id;
      const tubePd = this.tubeCache[id];
      cumulativeCellCount += tubePd.getNumberOfCells();
      this.cellToTubeId[i] = [cumulativeCellCount, id];
    }
  }
}

export default {
  TubeCollection,
  centerlineToTube,
  convertStripsToPolys,
};
